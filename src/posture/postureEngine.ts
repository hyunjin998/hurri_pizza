import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision'

export type PostureStatus = 'uncalibrated' | 'calibrating' | 'good' | 'warning' | 'danger'

/*
 * 화면에 보이는 문구(label/description)는 여기서 만들지 않는다 —
 * 언어별 문구는 src/i18n/strings.ts에서 status 값으로 찾아 쓴다.
 */
export interface PostureReading {
  status: PostureStatus
  /*
   * 이번 프레임에서 사람(귀/어깨)이 인식됐는지.
   * false면 status는 마지막으로 확정된 값을 그대로 유지한 것이므로,
   * 알림/응원 판단에는 쓰면 안 된다.
   */
  present: boolean
  ratio: number | null
  baseline: number | null
}

/*
 * 스무딩 시간 상수(ms). 감지 간격이 가변(배터리 절약을 위해 0.1~10초)이라
 * "프레임당 고정 비율"이 아니라 "경과 시간 기반" 지수 이동 평균을 쓴다.
 * 작을수록 민감, 클수록 둔감.
 */
const RATIO_SMOOTHING_TAU_MS = 900

/*
 * 상태가 바뀌려면 이 시간(ms) 이상 새 상태가 유지되어야 함
 */
const STATUS_HOLD_MS = 600

/*
 * 보정된 기준값(baseline) 대비 비율.
 * 예: 0.85면 기준 대비 85% 밑으로 떨어질 때 '주의'
 */
const WARNING_RATIO = 0.85
const DANGER_RATIO = 0.7

const CALIBRATION_DURATION_MS = 1500
const MIN_CALIBRATION_SAMPLES = 3
/*
 * 보정을 눌러놓고 자리를 비우면 빠른 감지(0.1초 간격)가 계속 돌아
 * 배터리를 먹으므로, 이 시간 안에 끝나지 않으면 보정을 취소한다.
 */
const CALIBRATION_TIMEOUT_MS = 15000

type Landmark = { x: number; y: number; visibility?: number }
type Landmarks = PoseLandmarkerResult['landmarks'][number]

/*
 * 프레임마다 좌표를 넣어주면 스무딩 + 개인 보정(calibration) +
 * 히스테리시스(hold time)를 적용해 안정적인 자세 상태를 계산해주는 엔진.
 * 웹앱(App.tsx)과 크롬 확장(offscreen)에서 공용으로 사용한다.
 */
export class PostureEngine {
  private smoothedRatio: number | null = null
  private lastProcessedAt: number | null = null
  private pendingStatus: 'good' | 'warning' | 'danger' | null = null
  private pendingSince = 0
  private committedStatus: 'good' | 'warning' | 'danger' = 'good'
  private baseline: number | null = null

  private calibrating = false
  private calibrationSamples: number[] = []
  private calibrationStartedAt = 0

  constructor(initialBaseline?: number | null) {
    if (initialBaseline != null && Number.isFinite(initialBaseline)) {
      this.baseline = initialBaseline
    }
  }

  get isCalibrated(): boolean {
    return this.baseline !== null
  }

  get isCalibrating(): boolean {
    return this.calibrating
  }

  getBaseline(): number | null {
    return this.baseline
  }

  /*
   * 사용자가 바른 자세로 앉은 상태에서 호출.
   * 이후 들어오는 프레임 몇 개를 평균 내 기준값으로 저장한다.
   */
  startCalibration(now: number): void {
    this.calibrating = true
    this.calibrationSamples = []
    this.calibrationStartedAt = now
  }

  cancelCalibration(): void {
    this.calibrating = false
    this.calibrationSamples = []
  }

  private static computeRawRatio(landmarks: Landmarks): number | null {
    const leftEar: Landmark | undefined = landmarks[7]
    const rightEar: Landmark | undefined = landmarks[8]
    const leftShoulder: Landmark | undefined = landmarks[11]
    const rightShoulder: Landmark | undefined = landmarks[12]

    if (!leftEar || !rightEar || !leftShoulder || !rightShoulder) {
      return null
    }

    const ear =
      (leftEar.visibility ?? 0) >= (rightEar.visibility ?? 0) ? leftEar : rightEar

    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 1e-6

    /*
     * 정면 카메라 기준, 고개가 앞으로 기울수록(거북목) 귀가 어깨선에 가까워져
     * 귀-어깨 수직 간격이 줄어든다. 어깨너비로 나눠 카메라와의 거리(줌 정도)
     * 영향을 최대한 제거한다.
     */
    return (shoulderMidY - ear.y) / shoulderWidth
  }

  /*
   * landmarks: MediaPipe pose landmark 배열 (사람이 없으면 undefined)
   * now: performance.now() 등 단조 증가 타임스탬프(ms)
   */
  process(landmarks: Landmarks | undefined, now: number): PostureReading {
    if (this.calibrating && now - this.calibrationStartedAt >= CALIBRATION_TIMEOUT_MS) {
      this.cancelCalibration()
    }

    const rawRatio = landmarks ? PostureEngine.computeRawRatio(landmarks) : null

    if (rawRatio === null) {
      return this.toReading(this.smoothedRatio, false)
    }

    if (this.calibrating) {
      this.calibrationSamples.push(rawRatio)

      if (
        now - this.calibrationStartedAt >= CALIBRATION_DURATION_MS &&
        this.calibrationSamples.length >= MIN_CALIBRATION_SAMPLES
      ) {
        const avg =
          this.calibrationSamples.reduce((a, b) => a + b, 0) /
          this.calibrationSamples.length

        this.baseline = avg
        this.smoothedRatio = avg
        this.lastProcessedAt = now
        this.pendingStatus = 'good'
        this.pendingSince = now
        this.committedStatus = 'good'
        this.calibrating = false
        this.calibrationSamples = []
      }

      return this.toReading(rawRatio, true)
    }

    /*
     * 경과 시간 기반 지수 이동 평균: 감지 간격이 길어져도 같은 "시간 감각"으로
     * 부드러워지고, 오래 쉬었다 돌아오면(dt가 크면) 새 값으로 바로 따라간다.
     */
    if (this.smoothedRatio === null || this.lastProcessedAt === null) {
      this.smoothedRatio = rawRatio
    } else {
      const dt = Math.max(0, now - this.lastProcessedAt)
      const alpha = 1 - Math.exp(-dt / RATIO_SMOOTHING_TAU_MS)
      this.smoothedRatio = this.smoothedRatio * (1 - alpha) + rawRatio * alpha
    }

    this.lastProcessedAt = now

    if (this.baseline === null) {
      return this.toReading(this.smoothedRatio, true)
    }

    const relative = this.smoothedRatio / this.baseline

    const candidate: 'good' | 'warning' | 'danger' =
      relative >= WARNING_RATIO ? 'good' : relative >= DANGER_RATIO ? 'warning' : 'danger'

    if (candidate !== this.pendingStatus) {
      this.pendingStatus = candidate
      this.pendingSince = now
    }

    const heldLongEnough = now - this.pendingSince >= STATUS_HOLD_MS

    this.committedStatus = heldLongEnough ? candidate : this.committedStatus

    return this.toReading(this.smoothedRatio, true)
  }

  private toReading(ratio: number | null, present: boolean): PostureReading {
    if (this.calibrating) {
      return { status: 'calibrating', present, ratio, baseline: this.baseline }
    }

    if (this.baseline === null) {
      return { status: 'uncalibrated', present, ratio, baseline: null }
    }

    return {
      status: this.committedStatus,
      present,
      ratio,
      baseline: this.baseline,
    }
  }
}
