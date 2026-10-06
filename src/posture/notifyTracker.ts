import { CHEER_MESSAGES, cheerTierFor, type CheerTier } from '../i18n/cheerMessages'
import type { PostureReading } from './postureEngine'

/*
 * 알림 판단 로직 (순수 함수)
 * ----------------------------------------------------------------
 * 웹앱(App.tsx)과 확장 background가 같이 쓴다. "언제 알릴지"만 결정하고,
 * 실제 알림 표시/문구 선택은 호출한 쪽이 한다. 상태(TrackerState)는 JSON으로
 * 직렬화 가능해서, 서비스워커가 꺼졌다 켜져도 chrome.storage에서 이어갈 수 있다.
 *
 * 1) 경고 알림: '주의'/'자세 점검'이 3초 이상 유지되면, 60초 쿨다운으로 알림
 * 2) 응원 알림: 바른 자세('양호')를 연속 15분 유지할 때마다 알림
 *    - 잠깐(5초 미만) 흐트러지는 것은 연속 기록을 끊지 않는다
 *    - 자리를 30초 넘게 비우거나, 감지가 60초 넘게 끊기면(절전 등) 기록 초기화
 */
export const ALERT_NOTIFY_HOLD_MS = 3000
export const NOTIFY_COOLDOWN_MS = 60_000
export const CHEER_INTERVAL_MS = 15 * 60_000
export const STREAK_BREAK_MS = 5000
export const ABSENT_GRACE_MS = 30_000
export const STALE_UPDATE_MS = 60_000

export interface TrackerState {
  alertSince: number | null
  goodSince: number | null
  absentSince: number | null
  lastAlertAt: number
  lastCheerAt: number
  lastCheerIndex: number
  lastUpdateAt: number | null
}

export const INITIAL_TRACKER_STATE: TrackerState = {
  alertSince: null,
  goodSince: null,
  absentSince: null,
  lastAlertAt: 0,
  lastCheerAt: 0,
  lastCheerIndex: -1,
  lastUpdateAt: null,
}

export type TrackerEvent =
  | { kind: 'alert'; status: 'warning' | 'danger' }
  | { kind: 'cheer'; minutes: number; tier: CheerTier; index: number }

export interface TrackerResult {
  state: TrackerState
  event: TrackerEvent | null
}

function pickIndex(length: number, last: number, rand: () => number): number {
  let index = Math.floor(rand() * length)

  if (length > 1 && index === last) {
    index = (index + 1) % length
  }

  return index
}

/*
 * now는 Date.now() 같은 "벽시계" 시각(ms)이어야 한다 (재시작 후에도 이어지도록).
 */
export function stepTracker(
  prev: TrackerState,
  reading: PostureReading,
  now: number,
  rand: () => number = Math.random,
): TrackerResult {
  const state: TrackerState = { ...prev }
  let event: TrackerEvent | null = null

  /*
   * 감지가 한참 끊겼다가 돌아온 경우(노트북 절전 등) 이전 기록은 무효.
   */
  if (state.lastUpdateAt !== null && now - state.lastUpdateAt > STALE_UPDATE_MS) {
    state.goodSince = null
    state.alertSince = null
    state.absentSince = null
  }

  state.lastUpdateAt = now

  if (!reading.present) {
    state.absentSince ??= now

    if (now - state.absentSince >= ABSENT_GRACE_MS) {
      state.goodSince = null
      state.alertSince = null
    }

    return { state, event }
  }

  state.absentSince = null

  if (reading.status === 'uncalibrated' || reading.status === 'calibrating') {
    state.goodSince = null
    state.alertSince = null
    return { state, event }
  }

  if (reading.status === 'warning' || reading.status === 'danger') {
    state.alertSince ??= now

    if (now - state.alertSince >= STREAK_BREAK_MS) {
      state.goodSince = null
    }

    const heldLongEnough = now - state.alertSince >= ALERT_NOTIFY_HOLD_MS
    const cooledDown = now - state.lastAlertAt > NOTIFY_COOLDOWN_MS

    if (heldLongEnough && cooledDown) {
      state.lastAlertAt = now
      event = { kind: 'alert', status: reading.status }
    }

    return { state, event }
  }

  /* good */
  state.alertSince = null
  state.goodSince ??= now

  const anchor = Math.max(state.goodSince, state.lastCheerAt)

  if (now - anchor >= CHEER_INTERVAL_MS) {
    const minutes = Math.max(1, Math.round((now - state.goodSince) / 60_000))
    const tier = cheerTierFor(minutes)
    const index = pickIndex(CHEER_MESSAGES[tier].length, state.lastCheerIndex, rand)

    state.lastCheerAt = now
    state.lastCheerIndex = index
    event = { kind: 'cheer', minutes, tier, index }
  }

  return { state, event }
}
