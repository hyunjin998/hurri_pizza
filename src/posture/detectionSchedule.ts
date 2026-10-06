import type { PostureReading } from './postureEngine'

/*
 * 감지 주기 스케줄러 (배터리 절약의 핵심)
 * ----------------------------------------------------------------
 * 자세는 초 단위로 급변하지 않으므로, 매 프레임(초당 6~60회) 모델을 돌릴
 * 필요가 없다. 지금 상태에 맞춰 "다음 감지까지 기다릴 시간"을 정한다.
 *
 *   보정 중                  0.1초  (짧은 시간 안에 샘플을 모아야 함)
 *   기준 미설정              0.5초
 *   주의/자세 점검           0.5초  (알림 3초 유지 판정을 정확히)
 *   양호                     1초
 *   자리 비움                2초 → 30초 넘게 비우면 5초 → 5분 넘게 비우면 10초
 *
 * 웹앱처럼 화면에 랜드마크를 그려주는 "보이는" 상태에서는 부드럽게
 * 보이도록 최대 0.25초 간격까지만 늘린다.
 */
const INTERVAL_CALIBRATING_MS = 100
const INTERVAL_UNCALIBRATED_MS = 500
const INTERVAL_ATTENTION_MS = 500
const INTERVAL_GOOD_MS = 1000

const INTERVAL_ABSENT_MS = 2000
const INTERVAL_ABSENT_LONG_MS = 5000
const INTERVAL_ABSENT_VERY_LONG_MS = 10000
const ABSENT_LONG_AFTER_MS = 30_000
const ABSENT_VERY_LONG_AFTER_MS = 5 * 60_000

const INTERVAL_VISIBLE_MAX_MS = 250
const INTERVAL_VISIBLE_ABSENT_MAX_MS = 1000 // 보이는 중이라도 자리를 비웠다면 천천히

export class DetectionScheduler {
  private absentSince: number | null = null

  /*
   * reading: 방금 처리한 결과 (아직 없으면 null)
   * now: 같은 시계(performance.now 등)의 현재 시각(ms)
   * visible: 화면에 결과를 그려주는 중인지 (웹앱의 포그라운드 탭)
   */
  next(reading: PostureReading | null, now: number, visible = false): number {
    if (reading !== null && !reading.present) {
      this.absentSince ??= now
    } else {
      this.absentSince = null
    }

    let interval: number

    if (reading === null) {
      interval = INTERVAL_UNCALIBRATED_MS
    } else if (reading.status === 'calibrating') {
      interval = INTERVAL_CALIBRATING_MS
    } else if (!reading.present) {
      const absentFor = now - (this.absentSince ?? now)

      interval =
        absentFor >= ABSENT_VERY_LONG_AFTER_MS
          ? INTERVAL_ABSENT_VERY_LONG_MS
          : absentFor >= ABSENT_LONG_AFTER_MS
            ? INTERVAL_ABSENT_LONG_MS
            : INTERVAL_ABSENT_MS
    } else if (reading.status === 'uncalibrated') {
      interval = INTERVAL_UNCALIBRATED_MS
    } else if (reading.status === 'good') {
      interval = INTERVAL_GOOD_MS
    } else {
      interval = INTERVAL_ATTENTION_MS
    }

    if (visible) {
      const cap =
        reading !== null && !reading.present
          ? INTERVAL_VISIBLE_ABSENT_MAX_MS
          : INTERVAL_VISIBLE_MAX_MS

      interval = Math.min(interval, cap)
    }

    return interval
  }

  reset(): void {
    this.absentSince = null
  }
}
