import { useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { CHEER_MESSAGES, cheerTitle, formatCheer } from './i18n/cheerMessages'
import { describeCameraError } from './i18n/cameraError'
import { LanguageToggle } from './i18n/LanguageToggle'
import { readingDescription, readingLabel } from './i18n/readingText'
import { getStrings } from './i18n/strings'
import { useLocale } from './i18n/useLocale'
import { ManualContent } from './manual/ManualContent'
import { DetectionScheduler } from './posture/detectionSchedule'
import {
  INITIAL_TRACKER_STATE,
  stepTracker,
  type TrackerEvent,
  type TrackerState,
} from './posture/notifyTracker'
import { PostureEngine, type PostureReading } from './posture/postureEngine'
import './App.css'

const BASELINE_STORAGE_KEY = 'huri-pizza:baseline'

function App() {
  const [locale, setLocale] = useLocale()
  const strings = getStrings(locale)

  /*
   * 감지 루프/알림 같은 오래 사는 콜백이 항상 "최신 언어"를 쓰도록 ref로도 들고 있는다.
   */
  const localeRef = useRef(locale)

  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  const [manualOpen, setManualOpen] = useState(
    () => window.location.hash === '#manual',
  )
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  /*
   * 사용자가 브라우저 설정에서 알림을 바꾸고 돌아오면 안내 배너가 바로 사라지도록
   * 창에 다시 포커스가 올 때 권한 상태를 새로 읽는다.
   */
  useEffect(() => {
    const refresh = () => {
      if (typeof Notification !== 'undefined') {
        setNotifPermission(Notification.permission)
      }
    }

    window.addEventListener('focus', refresh)

    return () => window.removeEventListener('focus', refresh)
  }, [])

  const requestNotifications = () => {
    if (typeof Notification === 'undefined') {
      return
    }

    void Notification.requestPermission().then(setNotifPermission)
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  /*
   * 감지 루프: rAF(초당 60회) 대신 setTimeout 체인으로, 상태에 맞춰
   * 다음 감지까지의 대기 시간을 조절한다 (배터리 절약, detectionSchedule.ts).
   */
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loopActiveRef = useRef(false)
  const schedulerRef = useRef(new DetectionScheduler())

  const lastTimestampRef = useRef<number>(0)

  const engineRef = useRef<PostureEngine | null>(null)

  const trackerRef = useRef<TrackerState>({ ...INITIAL_TRACKER_STATE })
  const lastShownRef = useRef<PostureReading | null>(null)

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

        setError(getStrings(localeRef.current).webModelLoadError)

        setLoading(false)
      }
    }

    initialize()

    return () => {
      loopActiveRef.current = false

      if (detectTimerRef.current !== null) {
        clearTimeout(detectTimerRef.current)
        detectTimerRef.current = null
      }

      streamRef.current?.getTracks().forEach((track) => {
        track.stop()
      })

      poseLandmarkerRef.current?.close()
    }
  }, [])

  /**
   * 브라우저/데스크탑 알림 전송 (경고 + 응원)
   * 언제 보낼지는 notifyTracker.ts가 정하고, 여기서는 표시만 한다.
   * (다른 탭/창을 보고 있어도 뜬다 — 이 페이지가 열려 있는 동안만 동작)
   */
  const showNotification = (event: TrackerEvent, reading: PostureReading) => {
    if (typeof Notification === 'undefined') {
      return
    }

    if (Notification.permission !== 'granted') {
      return
    }

    const currentLocale = localeRef.current
    const text = getStrings(currentLocale)

    if (event.kind === 'alert') {
      new Notification(
        event.status === 'danger' ? text.alertTitleDanger : text.alertTitleWarning,
        {
          body: text.statusDescription[reading.status],
          icon: '/favicon.svg',
          tag: 'posture-alert',
        },
      )

      return
    }

    new Notification(cheerTitle(currentLocale, event.minutes), {
      body: formatCheer(
        CHEER_MESSAGES[event.tier][event.index],
        currentLocale,
        event.minutes,
      ),
      icon: '/favicon.svg',
      tag: 'posture-cheer',
    })
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
        void Notification.requestPermission().then(setNotifPermission)
      }

      if (!poseLandmarkerRef.current) {
        setError(strings.webModelNotReady)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // 포즈 모델 입력은 256px 정도라 HD 영상은 전력만 쓴다.
          // 화면이 16:9라 비율을 맞춰 저해상도/저프레임으로 연다.
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 24 },
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
      schedulerRef.current.reset()
      trackerRef.current = { ...INITIAL_TRACKER_STATE }
      loopActiveRef.current = true

      scheduleNext(0)
    } catch (err) {
      console.error('카메라 시작 실패:', err)

      setError(describeCameraError(err, strings))
    }
  }

  /**
   * 현재 자세를 기준으로 보정 시작
   * (바른 자세로 앉은 상태에서 눌러야 함)
   */
  const startCalibration = () => {
    engineRef.current?.startCalibration(performance.now())
    schedulerRef.current.reset()

    // 자리 비움 등으로 감지가 느려져 있어도 보정은 바로 시작한다
    if (loopActiveRef.current) {
      scheduleNext(0)
    }
  }

  /**
   * 다음 감지 예약 (항상 하나만 예약해둔다)
   */
  const scheduleNext = (delayMs: number) => {
    if (!loopActiveRef.current) {
      return
    }

    if (detectTimerRef.current !== null) {
      clearTimeout(detectTimerRef.current)
    }

    detectTimerRef.current = setTimeout(detectPose, delayMs)
  }

  /**
   * 자세 감지 (한 번 실행하고 다음 실행을 예약한다)
   */
  const detectPose = () => {
    detectTimerRef.current = null

    const video = videoRef.current
    const canvas = canvasRef.current
    const poseLandmarker = poseLandmarkerRef.current

    if (!loopActiveRef.current || !video || !canvas || !poseLandmarker) {
      return
    }

    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      scheduleNext(200)
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
      scheduleNext(50)
      return
    }

    lastTimestampRef.current = now

    let result: PoseLandmarkerResult

    try {
      result = poseLandmarker.detectForVideo(video, now)
    } catch (err) {
      console.error('Pose detection 실패:', err)
      scheduleNext(1000)
      return
    }

    const reading = drawResult(result, ctx, canvas, now)
    const visible = !document.hidden

    scheduleNext(schedulerRef.current.next(reading, now, visible))
  }

  /**
   * 결과 표시 + 알림 판단
   */
  const drawResult = (
    result: PoseLandmarkerResult,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    now: number,
  ): PostureReading | null => {
    const landmarks = result.landmarks?.[0]
    const engine = engineRef.current

    if (!engine) {
      return null
    }

    const reading = engine.process(landmarks, now)

    /*
     * 창이 가려져 있거나(최소화/다른 탭) 보이지 않으면 그리기/리렌더를 건너뛴다.
     * 단, 상태가 바뀐 순간은 반영해둔다.
     */
    const prevShown = lastShownRef.current
    const changed =
      prevShown === null ||
      prevShown.status !== reading.status ||
      prevShown.present !== reading.present

    if (!document.hidden || changed) {
      lastShownRef.current = reading
      setPosture(reading)
    }

    if (!document.hidden) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (landmarks) {
        drawLandmarks(ctx, canvas, landmarks)
      }
    }

    /*
     * 보정이 막 완료됐다면(baseline이 생겼다면) 저장해서
     * 다음에 켤 때도 다시 보정하지 않아도 되게 한다.
     * (매번 쓰지 않고 값이 바뀔 때만 저장)
     */
    if (
      reading.baseline !== null &&
      reading.baseline !== prevShown?.baseline
    ) {
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
     * 경고(주의/자세 점검 지속) / 응원(바른 자세 장기 유지) 알림 판단
     */
    const { state, event } = stepTracker(trackerRef.current, reading, Date.now())

    trackerRef.current = state

    if (event) {
      showNotification(event, reading)
    }

    return reading
  }

  /**
   * 귀/어깨 위치를 화면에 표시
   */
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: NonNullable<PoseLandmarkerResult['landmarks']>[number],
  ) => {
    const leftEar = landmarks[7]
    const rightEar = landmarks[8]
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]

    if (!leftEar || !rightEar || !leftShoulder || !rightShoulder) {
      return
    }

    const ear =
      (leftEar.visibility ?? 0) >= (rightEar.visibility ?? 0)
        ? leftEar
        : rightEar

    const shoulder =
      (leftShoulder.visibility ?? 0) >= (rightShoulder.visibility ?? 0)
        ? leftShoulder
        : rightShoulder

    drawPoint(ctx, ear.x * canvas.width, ear.y * canvas.height, 12, '#00ff88')

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
    loopActiveRef.current = false

    if (detectTimerRef.current !== null) {
      clearTimeout(detectTimerRef.current)
      detectTimerRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => {
      track.stop()
    })

    streamRef.current = null
    lastShownRef.current = null

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
        <div>
          <h1>{strings.appName}</h1>

          <p>{strings.webTagline}</p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="lang-toggle"
            onClick={() => setManualOpen(true)}
          >
            📖 {strings.manualButton}
          </button>

          <LanguageToggle
            locale={locale}
            label={strings.languageButtonLabel}
            onChange={setLocale}
          />
        </div>
      </header>

      {(notifPermission === 'default' || notifPermission === 'denied') && (
        <div className={`notif-banner ${notifPermission}`} role="status">
          <span>
            {notifPermission === 'denied'
              ? strings.notifBlocked
              : strings.notifDefault}
          </span>

          <span className="notif-banner-actions">
            {notifPermission === 'default' && (
              <button type="button" onClick={requestNotifications}>
                {strings.notifAllowButton}
              </button>
            )}

            <button type="button" onClick={() => setManualOpen(true)}>
              {strings.notifGuideLink}
            </button>
          </span>
        </div>
      )}

      {manualOpen && (
        <div className="manual-overlay" role="dialog" aria-modal="true">
          <div className="manual-overlay-bar">
            <LanguageToggle
              locale={locale}
              label={strings.languageButtonLabel}
              onChange={setLocale}
            />

            <button
              type="button"
              className="lang-toggle"
              onClick={() => setManualOpen(false)}
            >
              ✕ {strings.manualClose}
            </button>
          </div>

          <ManualContent locale={locale} />
        </div>
      )}

      <main className="main">
        <section className="camera-section">
          <div className="camera-container">
            <video ref={videoRef} className="camera" muted playsInline />

            <canvas ref={canvasRef} className="pose-canvas" />

            {!cameraStarted && (
              <div className="camera-placeholder">
                <div className="camera-icon">📷</div>

                <p>
                  {strings.webCameraPlaceholderTop}
                  <br />
                  {strings.webCameraPlaceholderBottom}
                </p>
              </div>
            )}

            {cameraStarted && !posture && (
              <div className="camera-message">{strings.webDetectingPerson}</div>
            )}
          </div>

          <div className="camera-buttons">
            {!cameraStarted ? (
              <button
                className="primary-button"
                onClick={startCamera}
                disabled={loading}
              >
                {loading ? strings.webModelLoading : strings.webStartCamera}
              </button>
            ) : (
              <>
                <button
                  className="primary-button"
                  onClick={startCalibration}
                  disabled={posture?.status === 'calibrating'}
                >
                  {posture?.status === 'calibrating'
                    ? strings.calibratingButton
                    : engineRef.current?.isCalibrated
                      ? strings.calibrateAgain
                      : strings.calibrate}
                </button>

                <button className="secondary-button" onClick={stopCamera}>
                  {strings.webStopCamera}
                </button>
              </>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="result-section">
          <div className="result-card">
            <h2>{strings.webCurrentPosture}</h2>

            {!posture ? (
              <div className="empty-result">{strings.webDetectingPerson}</div>
            ) : (
              <>
                <div className={`status ${posture.status}`}>
                  <span className="status-dot" />
                  <span>{readingLabel(posture, strings)}</span>
                </div>

                <p className="description">
                  {readingDescription(posture, strings)}
                </p>

                {relativePercent !== null && (
                  <div className="metric">
                    <div className="metric-header">
                      <span>{strings.webRelative}</span>
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
            <h2>{strings.webHowTitle}</h2>

            <p>{strings.webHowBody}</p>

            <p className="notice">{strings.webDisclaimer}</p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
