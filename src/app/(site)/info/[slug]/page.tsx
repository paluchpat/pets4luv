import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getInformationPage } from '@/lib/content'
import { RichContent } from '@/components/RichContent'
import { noIndex, pageDescription, pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }
const topicTitles: Record<string, string> = { adoption: 'How adoption works', volunteering: 'Volunteer with Pets4Luv' }

function redirectMovedArticle(slug: string) {
  if (slug === 'about') permanentRedirect('/about')
  if (slug === 'cat-adoption' || slug === 'dog-adoption') permanentRedirect(`/info/adoption#${slug}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  redirectMovedArticle(slug)
  const article = await getInformationPage(slug)
  const title = article?.title || topicTitles[slug]
  if (!title) return { title: 'Information not found', robots: noIndex }
  return pageMetadata({
    title,
    description: pageDescription(article?.body, title),
    path: `/info/${slug}`,
    indexable: Boolean(article),
  })
}

export default async function InformationPage({ params }: Props) {
  const { slug } = await params
  redirectMovedArticle(slug)
  const article = await getInformationPage(slug)
  if (!article && !topicTitles[slug]) notFound()
  return <main id="main" className="page-shell information-page"><p className="section-label">Pets4Luv information</p><h1>{article?.title || topicTitles[slug]}</h1>{article ? <RichContent value={article.body} text={article.bodyText} /> : <div className="unpublished-notice"><h2>Rescue information has not been published here yet.</h2><p>Please ask the rescue for its current {slug === 'volunteering' ? 'volunteering' : 'adoption'} information.</p><Link className="button" href="/contact">Contact the rescue <span aria-hidden="true">→</span></Link></div>}<div className="info-bottom"><Link className="text-link" href="/animals">Meet available animals →</Link></div></main>
}
