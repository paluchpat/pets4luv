import type { Metadata } from 'next'
import Link from 'next/link'
import { RichContent } from '@/components/RichContent'
import { getInformationPage, getWebsiteSettings, richTextToText } from '@/lib/content'

export const dynamic = 'force-dynamic'
const fallbackTitle = 'How adoption works'
const adoptionTopics = [
  { id: 'cat-adoption', label: 'Cat adoption' },
  { id: 'dog-adoption', label: 'Dog adoption' },
]

function matchesHeading(node: unknown, label: string) {
  if (!node || typeof node !== 'object') return false
  const { type, tag } = node as { type?: string; tag?: string }
  return type === 'heading' && tag === 'h2' &&
    richTextToText(node).trim().toLowerCase() === label.toLowerCase()
}

export async function generateMetadata(): Promise<Metadata> {
  const adoption = await getInformationPage('adoption')
  return { title: adoption?.title || fallbackTitle }
}

export default async function AdoptionPage() {
  const [adoption, settings] = await Promise.all([getInformationPage('adoption'), getWebsiteSettings()])
  const nodes = adoption?.body?.root?.children ?? []
  const sections = adoptionTopics.map(topic => ({ ...topic, headingIndex: nodes.findIndex(node => matchesHeading(node, topic.label)) }))
  const headingIds = new Map(sections.flatMap(({ headingIndex, id }) =>
    headingIndex >= 0 ? [[headingIndex, id]] : []
  ))
  const jumpLinks = sections.filter(({ headingIndex }) => headingIndex >= 0)

  return <main id="main" className="page-shell information-page">
    <p className="section-label">Pets4Luv information</p>
    <h1>{adoption?.title || fallbackTitle}</h1>
    {jumpLinks.length > 0 && <nav className="local-page-actions page-intro" aria-label="Adoption sections">
      {jumpLinks.map(({ id, label }) => <a key={id} className="button secondary" href={`#${id}`}>{label}</a>)}
    </nav>}
    {adoption ? <RichContent value={adoption.body} text={adoption.bodyText} headingIds={headingIds} /> : <div className="unpublished-notice">
      <h2>Adoption steps have not been published here yet.</h2>
      <p>Contact Pets4Luv for its current application and adoption requirements.</p>
      <a className="button" href={"mailto:" + settings.emailAddress}>Email Pets4Luv <span aria-hidden="true">→</span></a>
    </div>}
    <div className="info-bottom"><Link className="text-link" href="/animals">Meet available animals →</Link></div>
  </main>
}
