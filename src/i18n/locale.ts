/*
 * 지원 언어 정의 + 브라우저 언어 감지.
 * 웹앱(src), 크롬 확장(extension), Electron이 같이 쓴다.
 * 언어를 더 추가하려면: Locale 유니온 / LOCALES / LOCALE_NAMES에 추가하고,
 * strings.ts, cheerMessages.ts에 번역을 채우면 된다 (타입이 빠진 곳을 알려준다).
 */
export type Locale = 'ko' | 'en'

export const LOCALES: readonly Locale[] = ['ko', 'en']

export const LOCALE_NAMES: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
}

export function isLocale(value: unknown): value is Locale {
  return value === 'ko' || value === 'en'
}

/*
 * 저장된 설정이 없을 때 쓰는 기본값: 브라우저 언어가 한국어면 ko, 그 외는 en.
 */
export function detectLocale(): Locale {
  const language =
    typeof navigator !== 'undefined' ? (navigator.language ?? '') : ''

  return language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

/*
 * 토글 버튼용: 지금 언어의 "반대편" 언어.
 */
export function otherLocale(locale: Locale): Locale {
  return locale === 'ko' ? 'en' : 'ko'
}
