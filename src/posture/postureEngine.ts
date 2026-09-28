import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision'

export type PostureStatus = 'uncalibrated' | 'calibrating' | 'good' | 'warning' | 'danger'

export interface PostureReading {
  status: PostureStatus
  label: string
  description: string
  ratio: number | null
  baseline: number | null
}

/*
 * 스무딩 정도 (0~1, 작을수록 둔감)
 */
const RATIO_SMOOTHING = 0.15

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

const STATUS_LABELS: Record<'good' | 'warning' | 'danger', { label: string; description: string }> = {
  good: {
    label: '양호',
    description: '현재 자세가 비교적 안정적이에요.',
  },
  warning: {
    label: '주의',
    description: '고개가 기준 자세보다 앞으로 기울었어요.',
  },
  danger: {
    label: '자세 점검',
    description: '고개가 기준 자세보다 많이 기울었어요. 자세를 한번 바꿔보세요.',
  },
}

type Landmark = { x: number; y: number; visibility?: number }
type Landmarks = PoseLandmarkerResult['landmarks'][number]

/*
 * 프레임마다 좌표를 넣어주면 스무딩 + 개인 보정(calibration) +
 * 히스테리시스(hold time)를 적용해 안정적인 자세 상태를 계산해주는 엔진.
 * 웹앱(App.tsx)과 크롬 확장(offscreen)에서 공용으로 사용한다.
 */
export class PostureEngine {
  private smoothedRatio: number | null = null
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
    const rawRatio = landmarks ? PostureEngine.computeRawRatio(landmarks) : null

    if (rawRatio === null) {
      return this.toReading(this.smoothedRatio)
    }

    if (this.calibrating) {
      this.calibrationSamples.push(rawRatio)

      if (now - this.calibrationStartedAt >= CALIBRATION_DURATION_MS) {
        const avg =
          this.calibrationSamples.reduce((a, b) => a + b, 0) /
          this.calibrationSamples.length

        this.baseline = avg
        this.smoothedRatio = avg
        this.pendingStatus = 'good'
        this.pendingSince = now
        this.committedStatus = 'good'
        this.calibrating = false
        this.calibrationSamples = []
      }

      return this.toReading(rawRatio)
    }

    this.smoothedRatio =
      this.smoothedRatio === null
        ? rawRatio
        : this.smoothedRatio * (1 - RATIO_SMOOTHING) + rawRatio * RATIO_SMOOTHING

    if (this.baseline === null) {
      return this.toReading(this.smoothedRatio)
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

    return this.toReading(this.smoothedRatio)
  }

  private toReading(ratio: number | null): PostureReading {
    if (this.calibrating) {
      return {
        status: 'calibrating',
        label: '보정 중',
        description: '바른 자세를 유지한 채 잠시만 기다려주세요...',
        ratio,
        baseline: this.baseline,
      }
    }

    if (this.baseline === null) {
      return {
        status: 'uncalibrated',
        label: '보정 필요',
        description: '먼저 바른 자세로 기준을 설정해주세요.',
        ratio,
        baseline: null,
      }
    }

    const meta = STATUS_LABELS[this.committedStatus]

    return {
      status: this.committedStatus,
      label: meta.label,
      description: meta.description,
      ratio,
      baseline: this.baseline,
    }
  }
}
