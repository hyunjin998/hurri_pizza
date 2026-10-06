import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { PostureReading } from '../src/posture/postureEngine'
import { LanguageToggle } from '../src/i18n/LanguageToggle'
import { readingDescription, readingLabel } from '../src/i18n/readingText'
import { getStrings } from '../src/i18n/strings'
import { describeCameraError } from './cameraError'
import { broadcast, STORAGE_KEYS, type ExtensionMessage } from './messages'
import { useExtensionLocale } from './useExtensionLocale'
import './popup.css'

function Popup() {
  const [locale, setLocale] = useExtensionLocale()
  const strings = getStrings(locale)
  const [enabled, setEnabled] = useState(false)
  const [reading, setReading] = useState<PostureReading | null>(null)
  const [permissionError, setPermissionError] = useState('')
  const [justCalibrated, setJustCalibrated] = useState(false)
  const prevStatusRef = useRef<PostureReading['status'] | null>(null)

  useEffect(() => {
    void chrome.storage.local
      .get([STORAGE_KEYS.enabled, STORAGE_KEYS.reading])
      .then((stored) => {
        setEnabled(Boolean(stored[STORAGE_KEYS.enabled]))
        setReading(
          (stored[STORAGE_KEYS.reading] as PostureReading | undefined) ??
            null,
        )
      })

    const listener = (message: unknown) => {
      const msg = message as ExtensionMessage

      if (msg?.type === 'POSTURE_UPDATE') {
        setReading(msg.reading)
      }
    }

    chrome.runtime.onMessage.addListener(listener)
  }, [])

  /*
   * offscreen 문서는 화면에 보이지 않기 때문에 카메라 권한 팝업을 띄울 수
   * 없다. 그래서 감시를 켤 때, 화면이 보이는 이 팝업에서 먼저
   * getUserMedia를 한 번 호출해 카메라 권한을 받아둔다. 이 스트림 자체는
   * 바로 꺼버리고, 실제 카메라 사용은 offscreen 문서가 이어서 한다
   * (한 번 허용되면 같은 확장 origin에서는 다시 묻지 않는다).
   */
  const toggleEnabled = async () => {
    const next = !enabled
    setPermissionError('')

    if (next) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })

        stream.getTracks().forEach((track) => track.stop())
      } catch (err) {
        console.error('카메라 권한 요청 실패:', err)

        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          /*
           * 팝업은 임시 창이라 크롬이 권한 프롬프트 자체를 안 띄우고
           * 조용히 거부하는 경우가 흔하다. 계속 떠 있는 진짜 탭에서
           * 다시 요청하도록 안내 페이지를 연다.
           */
          setPermissionError(strings.popupPermissionTab)
          void chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') })
        } else {
          setPermissionError(describeCameraError(err, strings))
        }

        return
      }
    }

    setEnabled(next)
    void chrome.storage.local.set({ [STORAGE_KEYS.enabled]: next })
    broadcast({ type: 'SET_ENABLED', enabled: next })

    if (next) {
      /*
       * offscreen 문서는 화면에 안 보여서 사용자가 자기 모습을 확인할
       * 방법이 없다. 감시를 켤 때마다 미리보기 창을 함께 띄워준다
       * (특히 처음 켤 때 자리를 잡고 보정하기 편하도록).
       */
      openPreviewWindow()
    } else {
      setReading(null)
    }
  }

  /*
   * '보정 중' → 보정 완료 상태로 바뀌는 순간을 잡아 잠깐 안내를 보여준다.
   */
  useEffect(() => {
    const prev = prevStatusRef.current
    const current = reading?.status ?? null
    prevStatusRef.current = current

    if (
      prev === 'calibrating' &&
      current !== null &&
      current !== 'calibrating'
    ) {
      setJustCalibrated(true)
      const timer = setTimeout(() => setJustCalibrated(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [reading?.status])

  const calibrate = () => {
    broadcast({ type: 'START_CALIBRATION' })
  }

  const openManual = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('manual.html') })
  }

  const openPreviewWindow = () => {
    void chrome.windows.create({
      url: chrome.runtime.getURL('preview.html'),
      type: 'popup',
      width: 460,
      height: 560,
    })
  }

  const statusClass = reading?.status ?? 'uncalibrated'
  const statusLabel = reading
    ? readingLabel(reading, strings)
    : enabled
      ? strings.waiting
      : strings.off

  return (
    <div className="popup">
      <div className="popup-header">
        <h1>{strings.appName}</h1>
        <LanguageToggle
          locale={locale}
          label={strings.languageButtonLabel}
          onChange={setLocale}
        />
      </div>

      <button className="primary" onClick={() => void toggleEnabled()}>
        {enabled ? strings.popupDisable : strings.popupEnable}
      </button>

      {permissionError && (
        <p className="description error">{permissionError}</p>
      )}

      {justCalibrated && (
        <p className="description success">{strings.popupCalibrated}</p>
      )}

      {enabled && (
        <>
          <button className="secondary" onClick={openPreviewWindow}>
            {strings.popupShowPreview}
          </button>

          <button
            className="secondary"
            onClick={calibrate}
            disabled={reading?.status === 'calibrating'}
          >
            {reading?.status === 'calibrating'
              ? strings.calibratingButton
              : strings.calibrate}
          </button>
        </>
      )}

      <div className={`status ${statusClass}`}>{statusLabel}</div>

      {reading && (
        <p className="description">{readingDescription(reading, strings)}</p>
      )}

      <button className="link" onClick={openManual}>
        📖 {strings.popupManual}
      </button>
    </div>
  )
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<Popup />)
}
