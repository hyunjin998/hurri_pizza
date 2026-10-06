import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageToggle } from '../src/i18n/LanguageToggle'
import { getStrings } from '../src/i18n/strings'
import { describeCameraError } from './cameraError'
import { broadcast, STORAGE_KEYS } from './messages'
import { useExtensionLocale } from './useExtensionLocale'
import './permission.css'

/*
 * 확장 팝업(action popup)은 화면에 아주 잠깐 떠 있는 임시 창이라
 * 크롬이 카메라 권한 프롬프트를 아예 안 띄우고 조용히 NotAllowedError로
 * 거부하는 경우가 있다. 그래서 진짜 탭(계속 떠 있는 일반 페이지)에서
 * 한 번 더 요청한다 — 탭에서는 프롬프트가 정상적으로 뜬다.
 */
type Result = { kind: 'granted' } | { kind: 'error'; error: unknown } | null

function Permission() {
  const [locale, setLocale] = useExtensionLocale()
  const strings = getStrings(locale)
  const [result, setResult] = useState<Result>(null)
  const [requesting, setRequesting] = useState(false)

  const requestPermission = async () => {
    setRequesting(true)
    setResult(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })

      stream.getTracks().forEach((track) => track.stop())

      setResult({ kind: 'granted' })

      void chrome.storage.local.set({ [STORAGE_KEYS.enabled]: true })
      broadcast({ type: 'SET_ENABLED', enabled: true })
    } catch (err) {
      console.error('카메라 권한 요청 실패:', err)
      setResult({ kind: 'error', error: err })
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="permission">
      <div className="permission-top">
        <LanguageToggle
          locale={locale}
          label={strings.languageButtonLabel}
          onChange={setLocale}
        />
      </div>

      <h1>{strings.permissionTitle}</h1>

      <p>{strings.permissionBody}</p>

      <button onClick={() => void requestPermission()} disabled={requesting}>
        {requesting ? strings.permissionRequesting : strings.permissionButton}
      </button>

      {result && (
        <div className={`result ${result.kind === 'granted' ? 'success' : 'error'}`}>
          {result.kind === 'granted'
            ? strings.permissionGranted
            : describeCameraError(result.error, strings)}
        </div>
      )}
    </div>
  )
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<Permission />)
}
