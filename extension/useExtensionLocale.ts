import { useCallback, useEffect, useState } from 'react'
import { detectLocale, isLocale, type Locale } from '../src/i18n/locale'
import { STORAGE_KEYS } from './messages'

/*
 * 확장용 언어 훅. 언어는 chrome.storage.local에 저장해서
 * popup / preview / permission / background(알림 문구)가 같은 값을 쓴다.
 * 한 화면에서 바꾸면 열려 있는 다른 화면에도 바로 반영된다.
 */
export function useExtensionLocale(): [Locale, (next: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    void chrome.storage.local.get(STORAGE_KEYS.locale).then((stored) => {
      const value = stored[STORAGE_KEYS.locale]

      if (isLocale(value)) {
        setLocaleState(value)
      }
    })

    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      const value = changes[STORAGE_KEYS.locale]?.newValue

      if (areaName === 'local' && isLocale(value)) {
        setLocaleState(value)
      }
    }

    chrome.storage.onChanged.addListener(listener)

    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    void chrome.storage.local.set({ [STORAGE_KEYS.locale]: next })
  }, [])

  return [locale, setLocale]
}
