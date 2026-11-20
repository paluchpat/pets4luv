import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AnimalProfile } from '@/components/AnimalProfile'
import { previewAnimalDraft } from '@/lib/catministrator/animal-review'
import { getWebsiteSettings } from '@/lib/content'
import { noIndex } from '@/lib/seo'
import { applyWebsiteSettings } from '@/lib/website-settings'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Animal draft preview', robots: noIndex, referrer: 'no-referrer' }

export default async function AnimalPreview({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await getPayload({ config })
  const animal = await previewAnimalDraft(payload, token)
  if (!animal) notFound()
  const settings = await getWebsiteSettings(true)
  return <>
    <div className="preview-banner preview-banner--sticky" role="status">
      <strong>Animal draft preview</strong><span>Review the profile and return to Telegram when you’re ready.</span>
    </div>
    <AnimalProfile animal={applyWebsiteSettings(animal, settings)} />
  </>
}
