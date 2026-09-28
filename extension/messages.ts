import type { PostureReading } from '../src/posture/postureEngine'

/*
 * background / offscreen / popup 세 컨텍스트가 주고받는 메시지 타입.
 * chrome.runtime.sendMessage(message)는 대상 없이 보내면
 * 실행 중인 모든 확장 컨텍스트(팝업이 열려 있다면 팝업 포함)에 전달된다.
 */
export type ExtensionMessage =
  | { type: 'POSTURE_UPDATE'; reading: PostureReading }
  | { type: 'START_CALIBRATION' }
  | { type: 'SET_ENABLED'; enabled: boolean }
  | { type: 'GET_BASELINE' }

export interface GetBaselineResponse {
  baseline: number | null
}

export const STORAGE_KEYS = {
  enabled: 'enabled',
  reading: 'reading',
  baseline: 'baseline',
  alertSince: 'alertSince',
  lastNotifiedAt: 'lastNotifiedAt',
} as const

/*
 * sendMessage는 듣고 있는 컨텍스트가 하나도 없으면
 * "Could not establish connection" 에러를 던지는 대신 콜백의
 * chrome.runtime.lastError에 채워 넣는다. 무시해도 안전하다.
 */
export function broadcast(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError
  })
}

/*
 * offscreen 문서는 chrome.storage에 직접 접근하지 못하는 경우가 있어서
 * (환경에 따라 undefined로 나타남), storage 읽기/쓰기는 전부 background가
 * 대신 해준다. 이 함수는 background에게 저장된 보정값을 물어본다.
 */
export function requestBaseline(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_BASELINE' }, (response) => {
      void chrome.runtime.lastError
      const payload = response as GetBaselineResponse | undefined
      resolve(payload?.baseline ?? null)
    })
  })
}
