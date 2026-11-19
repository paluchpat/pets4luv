import { HomepageView } from '@/components/HomepageView'
import { getHomepage, getWebsiteSettings } from '@/lib/content'
import { homeDescription, homeTitle, pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata({ title: homeTitle, description: homeDescription, path: '/' })

export default async function HomePage() {
  const [homepage, settings] = await Promise.all([getHomepage(), getWebsiteSettings()])
  return <HomepageView homepage={homepage} settings={settings} />
}
