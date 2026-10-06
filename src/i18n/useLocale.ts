import { useCallback, useEffect, useState } from 'react'
import { detectLocale, isLocale, type Locale } from './locale'

const LOCALE_STORAGE_KEY = 'huri-pizza:locale'

export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)

    if (isLocale(stored)) {
      return stored
    }
  } catch {
    // localStorage 사용 불가 시 무시
  }

  return detectLocale()
}

/*
 * 웹앱/Electron용 언어 훅. 선택한 언어는 localStorage에 저장한다.
 * (크롬 확장은 background도 언어를 알아야 해서 chrome.storage를 쓰는
 *  extension/useExtensionLocale.ts를 따로 쓴다.)
 */
export function useLocale(): [Locale, (next: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)

    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // 저장 실패해도 이번 세션에서는 바뀐 언어를 쓴다
    }
  }, [])

  return [locale, setLocale]
}
