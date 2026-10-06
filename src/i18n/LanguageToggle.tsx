import { LOCALE_NAMES, otherLocale, type Locale } from './locale'

interface Props {
  locale: Locale
  label: string
  onChange: (next: Locale) => void
}

/*
 * 한국어 ↔ English 전환 버튼. 눌렀을 때 바뀔 언어 이름을 보여준다.
 * 스타일(.lang-toggle)은 각 화면의 CSS에서 정한다.
 */
export function LanguageToggle({ locale, label, onChange }: Props) {
  const next = otherLocale(locale)

  return (
    <button
      type="button"
      className="lang-toggle"
      aria-label={label}
      title={label}
      onClick={() => onChange(next)}
    >
      🌐 {LOCALE_NAMES[next]}
    </button>
  )
}
