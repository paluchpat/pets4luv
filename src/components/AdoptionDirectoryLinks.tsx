import type { WebsiteSettings } from '@/lib/website-settings'

export function AdoptionDirectoryLinks({ settings }: { settings: Pick<WebsiteSettings, 'petfinderUrl' | 'adoptAPetUrl'> }) {
  const links = [
    { url: settings.petfinderUrl, label: 'Petfinder' },
    { url: settings.adoptAPetUrl, label: 'Adopt a pet' },
  ].filter(link => link.url)
  if (!links.length) return null
  return <p className="gallery-listing-links">
    You can also find our adoptable animals on{' '}
    {links.map(({ url, label }, index) => <span key={label}>
      {index > 0 && ' and '}
      <a href={url} target="_blank" rel="noopener noreferrer">{label}<span className="sr-only"> (opens in a new tab)</span></a>
    </span>)}
  </p>
}
