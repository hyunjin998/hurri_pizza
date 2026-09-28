import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { PostureEngine } from '../src/posture/postureEngine'
import { broadcast, requestBaseline, type ExtensionMessage } from './messages'

/*
 * offscreen 문서
 * --------------
 * 탭/팝업과 무관하게 계속 떠 있는 숨겨진 페이지. 카메라를 잡고
 * MediaPipe로 자세를 감지해서 background로 상태를 보고한다.
 * background가 이 문서를 만들고 닫으므로, 이 문서가 살아있는 동안은
 * "감시 켜짐" 상태라고 봐도 된다.
 *
 * 주의: offscreen 문서는 화면에 그려지지 않으므로 브라우저의 렌더링/페인트
 * 파이프라인에서 제외된다. requestAnimationFrame은 그 파이프라인에 묶여
 * 있어서 offscreen 문서에서는 콜백이 아예 실행되지 않거나(관찰됨: 초기화는
 * 끝까지 성공하지만 이후 아무 로그도 찍히지 않음) 매우 불규칙하게 실행될
 * 수 있다. 그래서 감지 루프는 rAF 대신 setInterval로 구동한다.
 */

const DETECT_INTERVAL_MS = 150

let poseLandmarker: PoseLandmarker | null = null
let engine: PostureEngine | null = null
let detectTimer: ReturnType<typeof setInterval> | null = null
let lastTimestamp = 0
let lastBroadcastAt = 0
let detecting = false

const video = document.createElement('video')
video.muted = true
video.playsInline = true
document.body.appendChild(video)

async function initPoseLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    chrome.runtime.getURL('wasm'),
  )

  return PoseLandmarker.createFromOptions(vision, {
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
}

async function startCamera(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
    },
    audio: false,
  })

  video.srcObject = stream

  await video.play()

  lastTimestamp = 0

  if (detectTimer !== null) {
    clearInterval(detectTimer)
  }

  detectTimer = setInterval(() => {
    void detectTick()
  }, DETECT_INTERVAL_MS)
}

async function detectTick(): Promise<void> {
  if (!poseLandmarker || !engine || detecting) {
    return
  }

  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth === 0
  ) {
    return
  }

  const now = performance.now()

  if (now <= lastTimestamp) {
    return
  }

  lastTimestamp = now
  detecting = true

  try {
    let result: PoseLandmarkerResult

    try {
      result = poseLandmarker.detectForVideo(video, now)
    } catch (err) {
      console.error('[posture-check] Pose detection 실패:', err)
      return
    }

    const reading = engine.process(result.landmarks?.[0], now)

    /*
     * 매 tick(최대 초당 수십 번)마다 메시지를 보내면 낭비이므로
     * 약 300ms 간격으로만 브로드캐스트한다. baseline/reading 저장은
     * background가 이 메시지를 받아서 대신 처리한다
     * (offscreen 문서에서는 chrome.storage 접근이 막혀 있는 경우가 있다).
     */
    if (now - lastBroadcastAt > 300) {
      lastBroadcastAt = now
      broadcast({ type: 'POSTURE_UPDATE', reading })
    }
  } finally {
    detecting = false
  }
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as ExtensionMessage

  if (msg?.type === 'START_CALIBRATION') {
    engine?.startCalibration(performance.now())
  }
})

async function init(): Promise<void> {
  console.log('[posture-check] offscreen 초기화 시작')

  const baseline = await requestBaseline()
  engine = new PostureEngine(baseline)

  poseLandmarker = await initPoseLandmarker()
  console.log('[posture-check] PoseLandmarker 준비 완료')

  await startCamera()
  console.log('[posture-check] 카메라 시작됨, 감지 루프 시작 (setInterval 기반)')
}

init().catch((err: unknown) => {
  console.error('[posture-check] 오프스크린 초기화 실패:', err)
})

window.addEventListener('beforeunload', () => {
  if (detectTimer !== null) {
    clearInterval(detectTimer)
    detectTimer = null
  }

  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach((track) => track.stop())
})
