import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getKnowledge } from '@/lib/content'
import { RichContent } from '@/components/RichContent'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }
const topicTitles: Record<string, string> = { adoption: 'How adoption works', volunteering: 'Volunteer with Pets4Luv' }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (slug === 'about') permanentRedirect('/about')
  const article = await getKnowledge(slug)
  return { title: article?.title || topicTitles[slug] || 'Information' }
}

export default async function InformationPage({ params }: Props) {
  const { slug } = await params
  if (slug === 'about') permanentRedirect('/about')
  const article = await getKnowledge(slug)
  if (!article && !topicTitles[slug]) notFound()
  return <main id="main" className="page-shell information-page"><p className="section-label">Pets4Luv information</p><h1>{article?.title || topicTitles[slug]}</h1>{article ? <><RichContent value={article.body} text={article.bodyText} />{article.reviewedAt && <p className="small-note">Reviewed {new Date(article.reviewedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>}</> : <div className="unpublished-notice"><h2>Rescue information has not been published here yet.</h2><p>This local demo does not contain approved {slug === 'volunteering' ? 'volunteering' : 'adoption'} policies. Please contact Pets4Luv for current information.</p><Link className="button" href="/contact">Contact the rescue <span aria-hidden="true">→</span></Link></div>}<div className="info-bottom"><Link className="text-link" href="/animals">Meet available animals →</Link>{!article && <p className="small-note">Development demo · Approved rescue information will appear here when published.</p>}</div></main>
}
