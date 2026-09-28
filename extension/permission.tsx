import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describeCameraError } from './cameraError'
import { broadcast, STORAGE_KEYS } from './messages'
import './permission.css'

/*
 * 확장 팝업(action popup)은 화면에 아주 잠깐 떠 있는 임시 창이라
 * 크롬이 카메라 권한 프롬프트를 아예 안 띄우고 조용히 NotAllowedError로
 * 거부하는 경우가 있다. 그래서 진짜 탭(계속 떠 있는 일반 페이지)에서
 * 한 번 더 요청한다 — 탭에서는 프롬프트가 정상적으로 뜬다.
 */
function Permission() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [requesting, setRequesting] = useState(false)

  const requestPermission = async () => {
    setRequesting(true)
    setStatus('idle')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })

      stream.getTracks().forEach((track) => track.stop())

      setStatus('success')
      setMessage(
        '카메라 권한이 허용됐어요. 이 탭은 닫으셔도 되고, 확장 아이콘을 눌러 ' +
          '감시를 시작해주세요.',
      )

      void chrome.storage.local.set({ [STORAGE_KEYS.enabled]: true })
      broadcast({ type: 'SET_ENABLED', enabled: true })
    } catch (err) {
      console.error('카메라 권한 요청 실패:', err)
      setStatus('error')
      setMessage(describeCameraError(err))
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="permission">
      <h1>카메라 권한이 필요해요</h1>

      <p>
        Huri Pizza가 백그라운드에서 자세를 감지하려면 카메라 접근 권한이
        필요합니다. 아래 버튼을 누르면 크롬이 권한 요청 팝업을 보여줘요 —
        &lsquo;허용&rsquo;을 눌러주세요.
      </p>

      <button onClick={() => void requestPermission()} disabled={requesting}>
        {requesting ? '요청 중...' : '카메라 권한 허용하기'}
      </button>

      {status !== 'idle' && (
        <div className={`result ${status}`}>{message}</div>
      )}
    </div>
  )
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<Permission />)
}
