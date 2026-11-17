import { Facebook, Instagram, Music2 } from 'lucide-react'
import type { WebsiteSettings } from '@/lib/website-settings'

export function SocialLinks({ settings }: { settings: Pick<WebsiteSettings, 'instagramUrl' | 'facebookUrl' | 'tiktokUrl'> }) {
  const links = [
    { url: settings.instagramUrl, label: 'Instagram', Icon: Instagram },
    { url: settings.facebookUrl, label: 'Facebook', Icon: Facebook },
    { url: settings.tiktokUrl, label: 'TikTok', Icon: Music2 },
  ].filter(link => link.url)
  if (!links.length) return null
  return <div className="social-links">{links.map(({ url, label, Icon }) =>
    <a key={label} href={url}><Icon aria-hidden="true" focusable="false" /><span>{label}</span></a>
  )}</div>
}
