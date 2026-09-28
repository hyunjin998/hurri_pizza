/*
 * 이 프로젝트는 네트워크 제약으로 @types/chrome을 설치하지 못해,
 * 실제로 사용하는 API만 최소한으로 직접 선언한다.
 * (정식 타입이 필요하면 나중에 `pnpm add -D @types/chrome`으로 교체해도 된다)
 */
declare namespace chrome.runtime {
  interface MessageSender {
    tab?: { id?: number }
    id?: string
  }

  function sendMessage(
    message: unknown,
    callback?: (response: unknown) => void,
  ): void

  const onMessage: {
    addListener(
      callback: (
        message: unknown,
        sender: MessageSender,
        sendResponse: (response?: unknown) => void,
      ) => boolean | void,
    ): void
  }

  const onInstalled: {
    addListener(callback: () => void): void
  }

  const onStartup: {
    addListener(callback: () => void): void
  }

  function getURL(path: string): string

  const lastError: { message?: string } | undefined
}

declare namespace chrome.storage {
  interface StorageArea {
    get(
      keys?: string | string[] | Record<string, unknown> | null,
    ): Promise<Record<string, unknown>>
    set(items: Record<string, unknown>): Promise<void>
  }

  const local: StorageArea
}

declare namespace chrome.offscreen {
  type Reason = 'USER_MEDIA' | 'AUDIO_PLAYBACK' | 'DOM_SCRAPING'

  interface CreateParameters {
    url: string
    reasons: Reason[]
    justification: string
  }

  function createDocument(params: CreateParameters): Promise<void>
  function closeDocument(): Promise<void>
  function hasDocument(): Promise<boolean>
}

declare namespace chrome.tabs {
  interface CreateProperties {
    url?: string
    active?: boolean
  }

  function create(properties: CreateProperties): Promise<unknown>
}

declare namespace chrome.windows {
  interface CreateData {
    url?: string
    type?: 'normal' | 'popup' | 'panel'
    width?: number
    height?: number
    focused?: boolean
  }

  function create(createData: CreateData): Promise<unknown>
}

declare namespace chrome.notifications {
  interface NotificationOptions {
    type: 'basic' | 'image' | 'list' | 'progress'
    iconUrl: string
    title: string
    message: string
  }

  function create(
    notificationId: string,
    options: NotificationOptions,
    callback?: (id: string) => void,
  ): void
}
