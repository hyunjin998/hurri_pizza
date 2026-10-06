import { CHEER_MESSAGES, cheerTitle, formatCheer } from '../src/i18n/cheerMessages'
import { detectLocale, isLocale, type Locale } from '../src/i18n/locale'
import { getStrings } from '../src/i18n/strings'
import {
  INITIAL_TRACKER_STATE,
  stepTracker,
  type TrackerEvent,
  type TrackerState,
} from '../src/posture/notifyTracker'
import type { PostureReading } from '../src/posture/postureEngine'
import { STORAGE_KEYS, type ExtensionMessage } from './messages'

/*
 * background service worker
 * -------------------------
 * DOM/카메라가 필요한 실제 자세 감지는 offscreen 문서(offscreen.ts)가 맡고,
 * 이 파일은 (1) 감시 on/off에 따라 offscreen 문서를 만들고 없애는 것과
 * (2) 자세 경고 알림과 "바른 자세 오래 유지" 응원 알림을 보내는 것만 담당한다
 * (언제 알릴지는 src/posture/notifyTracker.ts, 응원 문구는
 *  src/i18n/cheerMessages.ts, 나머지 문구는 src/i18n/strings.ts).
 *
 * MV3 서비스워커는 유휴 상태가 되면 꺼졌다가 이벤트가 오면 다시 깨어나므로,
 * 알림 추적 상태(tracker)는 chrome.storage.local에 저장해 재기동돼도
 * 이어지도록 한다. 다만 매 업데이트(최대 초당 2~3회)마다 쓰면 낭비이므로
 * 메모리에 캐시해두고, 의미 있는 변화가 있을 때나 5초마다만 저장한다.
 */

const OFFSCREEN_URL = 'offscreen.html'
async function hasOffscreenDocument(): Promise<boolean> {
  try {
    return await chrome.offscreen.hasDocument()
  } catch {
    return false
  }
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log('[posture-check] offscreen 문서 이미 존재함')
    return
  }

  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['USER_MEDIA'],
      justification:
        '카메라 영상을 지속적으로 분석해 자세를 감지하기 위해 필요합니다.',
    })
    console.log('[posture-check] offscreen 문서 생성 완료')
  } catch (err) {
    console.error('[posture-check] offscreen 문서 생성 실패:', err)
    throw err
  }
}

async function closeOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument()
  }
}

async function setEnabled(enabled: boolean): Promise<void> {
  console.log('[posture-check] SET_ENABLED 수신:', enabled)

  await chrome.storage.local.set({ [STORAGE_KEYS.enabled]: enabled })

  if (!enabled) {
    // 감시를 끄면 응원/경고 연속 기록도 초기화한다
    cachedTracker = { ...INITIAL_TRACKER_STATE }
    lastPersistedReading = null
    await chrome.storage.local.set({
      [STORAGE_KEYS.tracker]: cachedTracker,
    })
  }

  try {
    if (enabled) {
      await ensureOffscreenDocument()
    } else {
      await closeOffscreenDocument()
    }
  } catch (err) {
    console.error('[posture-check] setEnabled 처리 중 에러:', err)
  }
}

async function restoreOnStartup(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.enabled)

  if (stored[STORAGE_KEYS.enabled]) {
    await ensureOffscreenDocument()
  }
}

const PERSIST_INTERVAL_MS = 5000

let cachedTracker: TrackerState | null = null
let lastTrackerPersistAt = 0
let lastReadingPersistAt = 0
let lastPersistedReading: PostureReading | null = null

/*
 * 메시지가 연달아 와도 순서대로 하나씩 처리한다 (storage 읽기/쓰기 경합 방지).
 */
let updateQueue: Promise<void> = Promise.resolve()

async function readLocale(): Promise<Locale> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.locale)
  const value = stored[STORAGE_KEYS.locale]

  return isLocale(value) ? value : detectLocale()
}

async function loadTracker(): Promise<TrackerState> {
  if (cachedTracker !== null) {
    return cachedTracker
  }

  const stored = await chrome.storage.local.get(STORAGE_KEYS.tracker)
  const value = stored[STORAGE_KEYS.tracker]

  cachedTracker =
    value && typeof value === 'object'
      ? { ...INITIAL_TRACKER_STATE, ...(value as Partial<TrackerState>) }
      : { ...INITIAL_TRACKER_STATE }

  return cachedTracker
}

function trackerChangedMeaningfully(prev: TrackerState, next: TrackerState): boolean {
  return (
    prev.alertSince !== next.alertSince ||
    prev.goodSince !== next.goodSince ||
    prev.absentSince !== next.absentSince ||
    prev.lastAlertAt !== next.lastAlertAt ||
    prev.lastCheerAt !== next.lastCheerAt
  )
}

async function showNotification(event: TrackerEvent, reading: PostureReading, now: number) {
  const locale = await readLocale()
  const strings = getStrings(locale)

  if (event.kind === 'alert') {
    chrome.notifications.create(`posture-alert-${now}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title:
        event.status === 'danger' ? strings.alertTitleDanger : strings.alertTitleWarning,
      message: strings.statusDescription[reading.status],
    })

    return
  }

  chrome.notifications.create(`posture-cheer-${now}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: cheerTitle(locale, event.minutes),
    message: formatCheer(CHEER_MESSAGES[event.tier][event.index], locale, event.minutes),
  })
}

async function handlePostureUpdate(reading: PostureReading): Promise<void> {
  const now = Date.now()

  /*
   * offscreen 문서는 chrome.storage에 직접 접근하지 못하는 경우가 있어서
   * reading/baseline 저장도 여기서 대신 처리한다.
   * 팝업이 열릴 때 읽는 용도라 상태가 바뀌었거나 5초가 지났을 때만 쓴다.
   */
  const readingChanged =
    lastPersistedReading === null ||
    lastPersistedReading.status !== reading.status ||
    lastPersistedReading.present !== reading.present ||
    lastPersistedReading.baseline !== reading.baseline

  if (readingChanged || now - lastReadingPersistAt >= PERSIST_INTERVAL_MS) {
    const toPersist: Record<string, unknown> = {
      [STORAGE_KEYS.reading]: reading,
    }

    if (reading.baseline !== null) {
      toPersist[STORAGE_KEYS.baseline] = reading.baseline
    }

    lastPersistedReading = reading
    lastReadingPersistAt = now
    await chrome.storage.local.set(toPersist)
  }

  const prev = await loadTracker()
  const { state, event } = stepTracker(prev, reading, now)

  cachedTracker = state

  if (
    event !== null ||
    trackerChangedMeaningfully(prev, state) ||
    now - lastTrackerPersistAt >= PERSIST_INTERVAL_MS
  ) {
    lastTrackerPersistAt = now
    await chrome.storage.local.set({ [STORAGE_KEYS.tracker]: state })
  }

  if (event !== null) {
    await showNotification(event, reading, now)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void restoreOnStartup()
})

chrome.runtime.onStartup.addListener(() => {
  void restoreOnStartup()
})

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const msg = message as ExtensionMessage

    if (msg?.type === 'SET_ENABLED') {
      void setEnabled(msg.enabled)
      return
    }

    if (msg?.type === 'POSTURE_UPDATE') {
      updateQueue = updateQueue
        .then(() => handlePostureUpdate(msg.reading))
        .catch((err: unknown) => {
          console.error('[posture-check] 자세 업데이트 처리 실패:', err)
        })
      return
    }

    if (msg?.type === 'GET_BASELINE') {
      void chrome.storage.local.get(STORAGE_KEYS.baseline).then((stored) => {
        const value = stored[STORAGE_KEYS.baseline]
        sendResponse({ baseline: typeof value === 'number' ? value : null })
      })
      return true // 비동기 응답을 위해 메시지 채널을 열어둔다
    }
  },
)
