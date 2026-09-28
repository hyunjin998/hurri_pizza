import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { PostureReading } from '../src/posture/postureEngine'
import { broadcast, STORAGE_KEYS, type ExtensionMessage } from './messages'
import { describeCameraError } from './cameraError'
import './preview.css'

/*
 * 이 창은 "감지"는 하지 않는다 — 실제 감지는 계속 offscreen 문서가 한다.
 * 여기서는 사용자가 자기 모습을 보면서 카메라 프레임/자세를 눈으로
 * 확인할 수 있도록 카메라를 별도로 한 번 더 열어서 보여주기만 하고,
 * 상태 배지는 offscreen이 브로드캐스트하는 POSTURE_UPDATE를 그대로 받아
 * 표시한다.
 */
function Preview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reading, setReading] = useState<PostureReading | null>(null)
  const [error, setError] = useState('')
  const [justCalibrated, setJustCalibrated] = useState(false)
  const prevStatusRef = useRef<PostureReading['status'] | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        console.error('[posture-check] 카메라 미리보기 실패:', err)
        setError(describeCameraError(err))
      }
    }

    void start()

    console.log('[posture-check] preview 창 열림, 저장된 상태 조회 중')

    void chrome.storage.local
      .get(STORAGE_KEYS.reading)
      .then((stored) => {
        console.log('[posture-check] preview 저장된 reading:', stored)
        setReading(
          (stored[STORAGE_KEYS.reading] as PostureReading | undefined) ??
            null,
        )
      })
      .catch((err: unknown) => {
        console.error('[posture-check] preview storage 조회 실패:', err)
      })

    const listener = (message: unknown) => {
      const msg = message as ExtensionMessage
      if (msg?.type === 'POSTURE_UPDATE') {
        console.log('[posture-check] preview POSTURE_UPDATE 수신:', msg.reading.status)
        setReading(msg.reading)
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  /*
   * '보정 중' → 보정이 끝난 상태로 바뀌는 순간을 잡아서
   * 잠깐 "보정 완료" 토스트를 보여준다.
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

  const statusClass = reading?.status ?? 'uncalibrated'
  const statusLabel = reading?.label ?? '감지 대기 중...'
  const isCalibrated =
    reading !== null &&
    reading.status !== 'uncalibrated' &&
    reading.status !== 'calibrating'

  return (
    <div className="preview">
      <div className="stage">
        <video ref={videoRef} muted playsInline />
        <div className={`badge ${statusClass}`}>{statusLabel}</div>
      </div>

      {justCalibrated && (
        <div className="toast">
          ✅ 보정 완료! 이제부터 이 자세를 기준으로 알려드릴게요. 이 창은
          닫으셔도 감지가 계속돼요.
        </div>
      )}

      {error ? (
        <div className="error">{error}</div>
      ) : isCalibrated ? (
        <p className="hint hint-done">
          설정이 끝났어요. 이 창은 닫으셔도 괜찮아요 — 백그라운드에서 계속
          자세를 감지하고, 자세가 흐트러지면 알림으로 알려드릴게요.
        </p>
      ) : (
        <p className="hint">
          화면에 어깨와 얼굴이 잘 보이도록 자리를 잡은 다음, 바른 자세로
          앉은 상태에서 아래 버튼을 눌러주세요.
        </p>
      )}

      <button onClick={calibrate} disabled={reading?.status === 'calibrating'}>
        {reading?.status === 'calibrating' ? '보정 중...' : '바른 자세로 기준 설정'}
      </button>
    </div>
  )
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<Preview />)
}
