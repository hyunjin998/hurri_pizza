import type { PostureReading } from '../src/posture/postureEngine'
import { STORAGE_KEYS, type ExtensionMessage } from './messages'

/*
 * background service worker
 * -------------------------
 * DOM/카메라가 필요한 실제 자세 감지는 offscreen 문서(offscreen.ts)가 맡고,
 * 이 파일은 (1) 감시 on/off에 따라 offscreen 문서를 만들고 없애는 것과
 * (2) '위험' 상태 지속 시간을 추적해 알림을 보내는 것만 담당한다.
 *
 * MV3 서비스워커는 유휴 상태가 되면 꺼졌다가 이벤트가 오면 다시 깨어나므로,
 * alertSince/lastNotifiedAt 같은 상태는 메모리가 아니라
 * chrome.storage.local에 저장해 재기동돼도 이어지도록 한다.
 */

const OFFSCREEN_URL = 'offscreen.html'
/*
 * '주의'(warning) 또는 '자세 점검'(danger) 상태가 이 시간(ms) 이상
 * 계속 유지되면 알림을 보낸다. 상태가 'good'으로 돌아오면 초기화된다.
 */
const ALERT_NOTIFY_HOLD_MS = 3000
const NOTIFY_COOLDOWN_MS = 60000

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

async function handlePostureUpdate(reading: PostureReading): Promise<void> {
  const now = Date.now()

  /*
   * offscreen 문서는 chrome.storage에 직접 접근하지 못하는 경우가 있어서
   * reading/baseline 저장도 여기서 대신 처리한다.
   */
  const toPersist: Record<string, unknown> = {
    [STORAGE_KEYS.reading]: reading,
  }

  if (reading.baseline !== null) {
    toPersist[STORAGE_KEYS.baseline] = reading.baseline
  }

  await chrome.storage.local.set(toPersist)

  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.alertSince,
    STORAGE_KEYS.lastNotifiedAt,
  ])

  let alertSince =
    typeof stored[STORAGE_KEYS.alertSince] === 'number'
      ? (stored[STORAGE_KEYS.alertSince] as number)
      : null

  const lastNotifiedAt =
    typeof stored[STORAGE_KEYS.lastNotifiedAt] === 'number'
      ? (stored[STORAGE_KEYS.lastNotifiedAt] as number)
      : 0

  /*
   * '주의'와 '자세 점검' 둘 다 사용자가 신경 써야 하는 상태이므로
   * 두 경우 모두 알림 대상으로 취급한다.
   */
  const needsAttention = reading.status === 'warning' || reading.status === 'danger'

  if (needsAttention) {
    if (alertSince === null) {
      alertSince = now
    }

    const heldLongEnough = now - alertSince >= ALERT_NOTIFY_HOLD_MS
    const cooledDown = now - lastNotifiedAt > NOTIFY_COOLDOWN_MS

    if (heldLongEnough && cooledDown) {
      const isDanger = reading.status === 'danger'

      chrome.notifications.create(`posture-alert-${now}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: isDanger ? '자세가 많이 흐트러졌어요 🙆' : '자세를 점검해주세요',
        message: reading.description,
      })

      await chrome.storage.local.set({ [STORAGE_KEYS.lastNotifiedAt]: now })
    }
  } else {
    alertSince = null
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.alertSince]: alertSince })
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
      console.log('[posture-check] POSTURE_UPDATE 수신:', msg.reading.status)
      void handlePostureUpdate(msg.reading)
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
