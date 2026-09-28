import { useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { PostureEngine, type PostureReading } from './posture/postureEngine'
import './App.css'

const ALERT_NOTIFY_HOLD_MS = 3000 // '주의'/'자세 점검' 알림을 보내기 전 유지해야 하는 시간(ms)
const NOTIFY_COOLDOWN_MS = 60000 // 알림 남발 방지 쿨다운

const BASELINE_STORAGE_KEY = 'huri-pizza:baseline'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const lastTimestampRef = useRef<number>(0)

  const engineRef = useRef<PostureEngine | null>(null)

  const alertSinceRef = useRef<number | null>(null)
  const lastNotifiedAtRef = useRef<number>(0)

  const [loading, setLoading] = useState(true)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [error, setError] = useState('')
  const [posture, setPosture] = useState<PostureReading | null>(null)

  /*
   * 저장된 보정값이 있으면 불러와서 엔진을 준비한다
   */
  if (engineRef.current === null) {
    let storedBaseline: number | null = null

    try {
      const raw = localStorage.getItem(BASELINE_STORAGE_KEY)
      storedBaseline = raw ? Number.parseFloat(raw) : null
    } catch {
      storedBaseline = null
    }

    engineRef.current = new PostureEngine(storedBaseline)
  }

  /**
   * MediaPipe 초기화
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('MediaPipe 초기화 시작')

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
        )

        console.log('WASM 로드 완료')

        const poseLandmarker =
          await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',

              delegate: 'GPU',
            },

            runningMode: 'VIDEO',

            numPoses: 1,

            minPoseDetectionConfidence: 0.3,
            minPosePresenceConfidence: 0.3,
            minTrackingConfidence: 0.3,
          })

        poseLandmarkerRef.current = poseLandmarker

        console.log('PoseLandmarker 초기화 완료')

        setLoading(false)
      } catch (err) {
        console.error('MediaPipe 초기화 실패:', err)

        setError(
          '자세 분석 모델을 불러오지 못했습니다. 브라우저 콘솔을 확인해주세요.',
        )

        setLoading(false)
      }
    }

    initialize()

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      streamRef.current?.getTracks().forEach((track) => {
        track.stop()
      })

      poseLandmarkerRef.current?.close()
    }
  }, [])

  /**
   * '주의' 또는 '자세 점검' 상태 지속 시 브라우저 알림 전송
   * (다른 탭/창을 보고 있어도 뜬다 — 이 페이지가 열려 있는 동안만 동작)
   */
  const notifyPosture = (reading: PostureReading) => {
    if (typeof Notification === 'undefined') {
      return
    }

    if (Notification.permission !== 'granted') {
      return
    }

    const isDanger = reading.status === 'danger'

    new Notification(
      isDanger ? '자세가 많이 흐트러졌어요 🙆' : '자세를 점검해주세요',
      {
        body: reading.description,
        icon: '/favicon.svg',
        tag: 'posture-alert',
      },
    )
  }

  /**
   * 카메라 시작
   */
  const startCamera = async () => {
    try {
      setError('')

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default'
      ) {
        void Notification.requestPermission()
      }

      if (!poseLandmarkerRef.current) {
        setError('자세 분석 모델이 아직 준비되지 않았습니다.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: {
            ideal: 1280,
          },
          height: {
            ideal: 720,
          },
          facingMode: 'user',
        },
        audio: false,
      })

      streamRef.current = stream

      const video = videoRef.current

      if (!video) {
        return
      }

      video.srcObject = stream

      await video.play()

      console.log('카메라 시작')
      console.log('videoWidth:', video.videoWidth)
      console.log('videoHeight:', video.videoHeight)

      setCameraStarted(true)

      lastTimestampRef.current = 0

      requestAnimationFrame(detectPose)
    } catch (err) {
      console.error('카메라 시작 실패:', err)

      setError(
        '카메라를 사용할 수 없습니다. 브라우저의 카메라 권한을 확인해주세요.',
      )
    }
  }

  /**
   * 현재 자세를 기준으로 보정 시작
   * (바른 자세로 앉은 상태에서 눌러야 함)
   */
  const startCalibration = () => {
    engineRef.current?.startCalibration(performance.now())
  }

  /**
   * 자세 감지
   */
  const detectPose = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const poseLandmarker = poseLandmarkerRef.current

    if (!video || !canvas || !poseLandmarker) {
      return
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      animationFrameRef.current =
        requestAnimationFrame(detectPose)

      return
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current =
        requestAnimationFrame(detectPose)

      return
    }

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return
    }

    /*
     * canvas 크기를 실제 영상 크기에 맞춤
     */
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    /*
     * MediaPipe VIDEO 모드는
     * 프레임마다 증가하는 timestamp가 필요하다.
     */
    const now = performance.now()

    if (now <= lastTimestampRef.current) {
      animationFrameRef.current =
        requestAnimationFrame(detectPose)

      return
    }

    lastTimestampRef.current = now

    let result: PoseLandmarkerResult

    try {
      result = poseLandmarker.detectForVideo(video, now)
    } catch (err) {
      console.error('Pose detection 실패:', err)

      animationFrameRef.current =
        requestAnimationFrame(detectPose)

      return
    }

    drawResult(result, ctx, canvas, now)

    animationFrameRef.current =
      requestAnimationFrame(detectPose)
  }

  /**
   * 결과 표시
   */
  const drawResult = (
    result: PoseLandmarkerResult,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    now: number,
  ) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const landmarks = result.landmarks?.[0]
    const engine = engineRef.current

    if (!engine) {
      return
    }

    const reading = engine.process(landmarks, now)

    setPosture(reading)

    /*
     * 보정이 막 완료됐다면(baseline이 생겼다면) 저장해서
     * 다음에 켤 때도 다시 보정하지 않아도 되게 한다
     */
    if (reading.baseline !== null) {
      try {
        localStorage.setItem(
          BASELINE_STORAGE_KEY,
          String(reading.baseline),
        )
      } catch {
        // localStorage 사용 불가 시 무시
      }
    }

    /*
     * 랜드마크가 있으면 귀/어깨 위치를 화면에 표시
     */
    if (landmarks) {
      const leftEar = landmarks[7]
      const rightEar = landmarks[8]
      const leftShoulder = landmarks[11]
      const rightShoulder = landmarks[12]

      const ear =
        (leftEar.visibility ?? 0) >= (rightEar.visibility ?? 0)
          ? leftEar
          : rightEar

      const shoulder =
        (leftShoulder.visibility ?? 0) >=
        (rightShoulder.visibility ?? 0)
          ? leftShoulder
          : rightShoulder

      drawPoint(
        ctx,
        ear.x * canvas.width,
        ear.y * canvas.height,
        12,
        '#00ff88',
      )

      drawPoint(
        ctx,
        shoulder.x * canvas.width,
        shoulder.y * canvas.height,
        12,
        '#00aaff',
      )

      ctx.beginPath()
      ctx.moveTo(ear.x * canvas.width, ear.y * canvas.height)
      ctx.lineTo(shoulder.x * canvas.width, shoulder.y * canvas.height)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 5
      ctx.stroke()
    }

    /*
     * '주의' 또는 '자세 점검' 상태가 일정 시간 이상 지속되면 브라우저 알림 전송
     */
    const needsAttention = reading.status === 'warning' || reading.status === 'danger'

    if (needsAttention) {
      if (alertSinceRef.current === null) {
        alertSinceRef.current = now
      }

      const heldLongEnough =
        now - alertSinceRef.current >= ALERT_NOTIFY_HOLD_MS

      const cooledDown =
        now - lastNotifiedAtRef.current > NOTIFY_COOLDOWN_MS

      if (heldLongEnough && cooledDown) {
        notifyPosture(reading)
        lastNotifiedAtRef.current = now
      }
    } else {
      alertSinceRef.current = null
    }
  }

  /**
   * 점 그리기
   */
  const drawPoint = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
  ) => {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  /**
   * 카메라 종료
   */
  const stopCamera = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => {
      track.stop()
    })

    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraStarted(false)
    setPosture(null)
  }

  const relativePercent =
    posture?.ratio != null && posture?.baseline
      ? Math.round((posture.ratio / posture.baseline) * 100)
      : null

  return (
    <div className="app">
      <header className="header">
        <h1>Huri Pizza</h1>

        <p>카메라로 현재 자세를 확인해보세요.</p>
      </header>

      <main className="main">
        <section className="camera-section">
          <div className="camera-container">
            <video ref={videoRef} className="camera" muted playsInline />

            <canvas ref={canvasRef} className="pose-canvas" />

            {!cameraStarted && (
              <div className="camera-placeholder">
                <div className="camera-icon">📷</div>

                <p>
                  카메라를 시작하면
                  <br />
                  자세 분석을 시작합니다.
                </p>
              </div>
            )}

            {cameraStarted && !posture && (
              <div className="camera-message">사람을 인식하는 중...</div>
            )}
          </div>

          <div className="camera-buttons">
            {!cameraStarted ? (
              <button
                className="primary-button"
                onClick={startCamera}
                disabled={loading}
              >
                {loading ? '모델 준비 중...' : '카메라 시작'}
              </button>
            ) : (
              <>
                <button
                  className="primary-button"
                  onClick={startCalibration}
                  disabled={posture?.status === 'calibrating'}
                >
                  {posture?.status === 'calibrating'
                    ? '보정 중...'
                    : engineRef.current?.isCalibrated
                      ? '기준 자세 다시 설정'
                      : '바른 자세로 기준 설정'}
                </button>

                <button className="secondary-button" onClick={stopCamera}>
                  카메라 종료
                </button>
              </>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="result-section">
          <div className="result-card">
            <h2>현재 자세</h2>

            {!posture ? (
              <div className="empty-result">사람을 인식하는 중...</div>
            ) : (
              <>
                <div className={`status ${posture.status}`}>
                  <span className="status-dot" />
                  <span>{posture.label}</span>
                </div>

                <p className="description">{posture.description}</p>

                {relativePercent !== null && (
                  <div className="metric">
                    <div className="metric-header">
                      <span>기준 자세 대비</span>
                      <span>{relativePercent}%</span>
                    </div>

                    <div className="progress">
                      <div
                        className={`progress-bar ${posture.status}`}
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(relativePercent, 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="info-card">
            <h2>측정 방법</h2>

            <p>
              먼저 바른 자세로 앉은 상태에서 &lsquo;바른 자세로 기준
              설정&rsquo;을 눌러 나만의 기준을 만드세요. 이후 귀와 어깨의
              위치가 그 기준에서 얼마나 벗어났는지를 비교해 자세를
              판단합니다.
            </p>

            <p className="notice">
              ※ 이 결과는 자세 상태를 확인하기 위한 참고용이며 의료적인
              진단이 아닙니다.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
