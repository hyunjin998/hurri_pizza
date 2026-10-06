import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageToggle } from '../src/i18n/LanguageToggle'
import { getManual } from '../src/i18n/manual'
import { getStrings } from '../src/i18n/strings'
import { ManualContent } from '../src/manual/ManualContent'
import { useExtensionLocale } from './useExtensionLocale'
import './manual.css'

/*
 * 확장 프로그램 사용 설명서 페이지 (팝업의 "사용 방법" 버튼으로 열린다).
 * 본문은 웹앱과 같은 컴포넌트/문구(src/i18n/manual.ts)를 쓴다.
 */
function ManualPage() {
  const [locale, setLocale] = useExtensionLocale()
  const strings = getStrings(locale)

  useEffect(() => {
    document.title = `${getManual(locale).title}`
  }, [locale])

  return (
    <>
      <div className="manual-page-top">
        <LanguageToggle
          locale={locale}
          label={strings.languageButtonLabel}
          onChange={setLocale}
        />
      </div>

      <ManualContent locale={locale} />
    </>
  )
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<ManualPage />)
}
