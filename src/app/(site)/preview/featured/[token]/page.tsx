import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import config from '@payload-config'
import { HomepageView } from '@/components/HomepageView'
import { previewFeaturedAnimals } from '@/lib/catministrator/featured-review'
import { getHomepage, getWebsiteSettings } from '@/lib/content'
import { noIndex } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Featured animals preview', robots: noIndex, referrer: 'no-referrer' }

export default async function FeaturedPreview({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await getPayload({ config })
  const ids = await previewFeaturedAnimals(payload, token)
  if (!ids) notFound()
  const [homepage, settings] = await Promise.all([getHomepage(ids), getWebsiteSettings(true)])
  if (homepage.featuredAnimals.length !== ids.length) notFound()
  return <>
    <div className="preview-banner" role="status"><strong>Featured animals preview</strong><span>Review the draft and return to Telegram to publish.</span></div>
    <HomepageView homepage={homepage} settings={settings} />
  </>
}
