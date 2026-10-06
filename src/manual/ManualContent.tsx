import { getManual } from '../i18n/manual'
import type { Locale } from '../i18n/locale'
import './manual.css'

/*
 * 사용 설명서 본문. 웹앱의 "사용 방법" 창과 확장의 manual.html이 공유한다.
 * 문구는 src/i18n/manual.ts에서 수정한다.
 */
export function ManualContent({ locale }: { locale: Locale }) {
  const manual = getManual(locale)

  return (
    <article className="manual">
      <h1>{manual.title}</h1>
      <p className="manual-intro">{manual.intro}</p>

      <nav className="manual-toc" aria-label="contents">
        {manual.sections.map((section) => (
          <a key={section.id} href={`#manual-${section.id}`}>
            {section.title.replace(/^⚠️\s*/, '')}
          </a>
        ))}
      </nav>

      {manual.sections.map((section) => (
        <section key={section.id} id={`manual-${section.id}`}>
          <h2>{section.title}</h2>

          {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}

          {section.steps && (
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}

          {section.callout && (
            <div className={`manual-callout ${section.callout.kind}`}>
              <strong>{section.callout.title}</strong>
              <p>{section.callout.body}</p>
            </div>
          )}
        </section>
      ))}
    </article>
  )
}
