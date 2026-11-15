import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { RichContent } from '@/components/RichContent'
import { getKnowledge, richTextToText } from '@/lib/content'

export const dynamic = 'force-dynamic'
const fallbackTitle = 'How adoption works'
const adoptionTopics = [
  { id: 'cat-adoption', label: 'Cat adoption' },
  { id: 'dog-adoption', label: 'Dog adoption' },
]
const getAdoption = cache(() => getKnowledge('adoption'))

function matchesHeading(node: unknown, label: string) {
  if (!node || typeof node !== 'object') return false
  const { type, tag } = node as { type?: string; tag?: string }
  return type === 'heading' && tag === 'h2' &&
    richTextToText(node).trim().toLowerCase() === label.toLowerCase()
}

export async function generateMetadata(): Promise<Metadata> {
  const adoption = await getAdoption()
  return { title: adoption?.title || fallbackTitle }
}

export default async function AdoptionPage() {
  const adoption = await getAdoption()
  const nodes = adoption?.body?.root?.children ?? []
  const sections = await Promise.all(adoptionTopics.map(async topic => {
    const headingIndex = nodes.findIndex(node => matchesHeading(node, topic.label))
    const article = headingIndex < 0 ? await getKnowledge(topic.id) : null
    return { ...topic, headingIndex, article }
  }))
  const headingIds = new Map(sections.flatMap(({ headingIndex, id }) =>
    headingIndex >= 0 ? [[headingIndex, id]] : []
  ))
  const jumpLinks = sections.filter(({ headingIndex, article }) => headingIndex >= 0 || article)

  return <main id="main" className="page-shell information-page">
    <p className="section-label">Pets4Luv information</p>
    <h1>{adoption?.title || fallbackTitle}</h1>
    {jumpLinks.length > 0 && <nav className="local-page-actions page-intro" aria-label="Adoption sections">
      {jumpLinks.map(({ id, label }) => <a key={id} className="button secondary" href={`#${id}`}>{label}</a>)}
    </nav>}
    {adoption ? <>
      <RichContent value={adoption.body} text={adoption.bodyText} headingIds={headingIds} />
      {adoption.reviewedAt && <p className="small-note">Reviewed {new Date(adoption.reviewedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>}
    </> : <div className="unpublished-notice">
      <h2>Adoption steps have not been published here yet.</h2>
      <p>Contact Pets4Luv for its current application and adoption requirements.</p>
      <a className="button" href="mailto:info@pets4luv.org">Email Pets4Luv <span aria-hidden="true">→</span></a>
    </div>}
    {sections.map(({ id, article }) => article && <section key={id} id={id} className="rich-content" tabIndex={-1} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{article.title}</h2>
      <RichContent value={article.body} text={article.bodyText} />
    </section>)}
    <div className="info-bottom"><Link className="text-link" href="/animals">Meet available animals →</Link></div>
  </main>
}
