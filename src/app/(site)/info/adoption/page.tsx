import type { Metadata } from 'next'
import Link from 'next/link'
import { RichContent } from '@/components/RichContent'
import { getKnowledge } from '@/lib/content'

export const dynamic = 'force-dynamic'
const fallbackTitle = 'How adoption works'

export async function generateMetadata(): Promise<Metadata> {
  const adoption = await getKnowledge('adoption')
  return { title: adoption?.title || fallbackTitle }
}

export default async function AdoptionPage() {
  const [adoption, cat, dog] = await Promise.all([
    getKnowledge('adoption'),
    getKnowledge('cat-adoption'),
    getKnowledge('dog-adoption'),
  ])
  const sections = [
    cat && { id: 'cat-adoption', label: 'Cat adoption', article: cat },
    dog && { id: 'dog-adoption', label: 'Dog adoption', article: dog },
  ].filter(section => section !== null)

  return <main id="main" className="page-shell information-page">
    <p className="section-label">Pets4Luv information</p>
    <h1>{adoption?.title || fallbackTitle}</h1>
    {sections.length > 0 && <nav className="local-page-actions page-intro" aria-label="Adoption sections">
      {sections.map(({ id, label }) => <a key={id} className="button secondary" href={`#${id}`}>{label}</a>)}
    </nav>}
    {adoption ? <>
      <RichContent value={adoption.body} text={adoption.bodyText} />
      {adoption.reviewedAt && <p className="small-note">Reviewed {new Date(adoption.reviewedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>}
    </> : <div className="unpublished-notice">
      <h2>Adoption steps have not been published here yet.</h2>
      <p>Contact Pets4Luv for its current application and adoption requirements.</p>
      <a className="button" href="mailto:info@pets4luv.org">Email Pets4Luv <span aria-hidden="true">→</span></a>
    </div>}
    {sections.map(({ id, article }) => <section key={id} id={id} className="rich-content" tabIndex={-1} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{article.title}</h2>
      <RichContent value={article.body} text={article.bodyText} />
    </section>)}
    <div className="info-bottom"><Link className="text-link" href="/animals">Meet available animals →</Link></div>
  </main>
}
