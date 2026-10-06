import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { DetectionScheduler } from '../src/posture/detectionSchedule'
import { PostureEngine, type PostureReading } from '../src/posture/postureEngine'
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
 * 수 있다. 그래서 감지 루프는 rAF 대신 setTimeout 체인으로 구동한다.
 *
 * 배터리 절약: 고정 주기(setInterval) 대신, 지금 상태에 맞춰 다음 감지까지의
 * 대기 시간을 매번 정한다 (양호 1초, 주의 0.5초, 자리 비움 2~10초 ... —
 * detectionSchedule.ts). 카메라도 저해상도/저프레임으로 연다.
 */

let poseLandmarker: PoseLandmarker | null = null
let engine: PostureEngine | null = null
const scheduler = new DetectionScheduler()
let detectTimer: ReturnType<typeof setTimeout> | null = null
let lastTimestamp = 0
let lastBroadcastAt = 0
let lastBroadcast: PostureReading | null = null
let stopped = false

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
      // 포즈 모델 입력은 256px 정도라 큰 해상도/프레임은 전력만 쓴다
      width: { ideal: 480 },
      height: { ideal: 360 },
      frameRate: { ideal: 10, max: 15 },
      facingMode: 'user',
    },
    audio: false,
  })

  video.srcObject = stream

  await video.play()

  lastTimestamp = 0
  scheduleNext(0)
}

function scheduleNext(delayMs: number): void {
  if (stopped) {
    return
  }

  if (detectTimer !== null) {
    clearTimeout(detectTimer)
  }

  detectTimer = setTimeout(() => {
    detectTimer = null
    void detectTick()
  }, delayMs)
}

async function detectTick(): Promise<void> {
  if (!poseLandmarker || !engine || stopped) {
    return
  }

  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth === 0
  ) {
    scheduleNext(300)
    return
  }

  const now = performance.now()

  if (now <= lastTimestamp) {
    scheduleNext(50)
    return
  }

  lastTimestamp = now

  let reading: PostureReading

  try {
    const result: PoseLandmarkerResult = poseLandmarker.detectForVideo(video, now)
    reading = engine.process(result.landmarks?.[0], now)
  } catch (err) {
    console.error('[posture-check] Pose detection 실패:', err)
    scheduleNext(1000)
    return
  }

  /*
   * 상태가 바뀌었거나 300ms 이상 지났을 때만 브로드캐스트한다
   * (보정 중에는 0.1초 간격이라 그대로 보내면 낭비).
   * baseline/reading 저장은 background가 이 메시지를 받아서 대신 처리한다
   * (offscreen 문서에서는 chrome.storage 접근이 막혀 있는 경우가 있다).
   */
  const changed =
    lastBroadcast === null ||
    lastBroadcast.status !== reading.status ||
    lastBroadcast.present !== reading.present

  if (changed || now - lastBroadcastAt >= 300) {
    lastBroadcastAt = now
    lastBroadcast = reading
    broadcast({ type: 'POSTURE_UPDATE', reading })
  }

  scheduleNext(scheduler.next(reading, now))
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as ExtensionMessage

  if (msg?.type === 'START_CALIBRATION') {
    engine?.startCalibration(performance.now())
    scheduler.reset()
    // 자리 비움 등으로 감지가 느려져 있어도 보정은 바로 시작한다
    scheduleNext(0)
  }
})

async function init(): Promise<void> {
  console.log('[posture-check] offscreen 초기화 시작')

  const baseline = await requestBaseline()
  engine = new PostureEngine(baseline)

  poseLandmarker = await initPoseLandmarker()
  console.log('[posture-check] PoseLandmarker 준비 완료')

  await startCamera()
  console.log('[posture-check] 카메라 시작됨, 감지 루프 시작 (적응형 setTimeout)')
}

init().catch((err: unknown) => {
  console.error('[posture-check] 오프스크린 초기화 실패:', err)
})

window.addEventListener('beforeunload', () => {
  stopped = true

  if (detectTimer !== null) {
    clearTimeout(detectTimer)
    detectTimer = null
  }

  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach((track) => track.stop())
})
