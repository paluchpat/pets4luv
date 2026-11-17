import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getPage, getWebsiteSettings } from '@/lib/content'
import { phoneHref } from '@/lib/website-settings'
import { Icon } from '@/components/Icons'
import { RichContent } from '@/components/RichContent'
import { SocialLinks } from '@/components/SocialLinks'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }

function redirectInformationPage(slug: string) {
  if (slug === 'adoption' || slug === 'volunteering') permanentRedirect(`/info/${slug}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  redirectInformationPage(slug)
  const page = await getPage(slug)
  return { title: page?.title || 'Page not found' }
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params
  redirectInformationPage(slug)
  const [page, settings] = await Promise.all([getPage(slug), getWebsiteSettings()])
  if (!page) notFound()
  const isDonate = slug === 'donate'
  const isContact = slug === 'contact'
  const mapsDestination = encodeURIComponent(settings.address)
  const hasSocialLinks = Boolean(settings.instagramUrl || settings.facebookUrl || settings.tiktokUrl)
  const donationLinks = [
    { url: settings.zeffyUrl, label: 'Donate with Zeffy', primary: true },
    { url: settings.paypalUrl, label: 'PayPal', primary: false },
    { url: settings.venmoUrl, label: 'Venmo' + (settings.venmoHandle ? ' @' + settings.venmoHandle : ''), primary: false },
  ].filter(link => link.url)

  return <main id="main" className={`page-shell information-page content-page${isDonate ? ' donation-page' : ''}`}>
    <p className="section-label">{isDonate ? 'Every bit of kindness matters' : isContact ? 'Let’s connect' : 'Pets4Luv information'}</p>
    <h1>{page.title}</h1>
    {isDonate && <section className="donation-options" aria-labelledby="donation-options-title">
      <h2 id="donation-options-title">Help bring families together.</h2>
      <p>Your generosity helps us continue to <strong>“bring families together one rescue at a time.”</strong></p>
      {donationLinks.length > 0 && <div className="donation-actions">
        {donationLinks.map(({ url, label, primary }) => <a key={label} className={primary ? 'button' : 'button secondary'} href={url} target="_blank" rel="noopener noreferrer">
          {label} <Icon kind="external" /><span className="sr-only"> (opens in a new tab)</span>
        </a>)}
      </div>}
      <div className="donation-mail">
        <h3>Mail a check</h3>
        <address>{settings.address}</address>
      </div>
    </section>}
    <RichContent value={page.body} text={page.bodyText} />
    {isContact && <section className="contact-details" aria-labelledby="contact-details-title">
      <div>
        <h2 id="contact-details-title">Contact details</h2>
        <dl className="contact-methods">
          <div><dt>Email</dt><dd><a href={"mailto:" + settings.emailAddress}>{settings.emailAddress}</a></dd></div>
          <div><dt>Phone</dt><dd><a href={phoneHref(settings.phone)}>{settings.phone}</a></dd></div>
          {hasSocialLinks && <div><dt>Social media</dt><dd><SocialLinks settings={settings} /></dd></div>}
        </dl>
        <h3>Visiting Pets4Luv</h3>
        <address>{settings.address}</address>
        <a className="text-link" href={`https://www.google.com/maps/dir/?api=1&destination=${mapsDestination}`} target="_blank" rel="noopener noreferrer">
          Google Maps directions&nbsp;<Icon kind="external" /><span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <iframe
        className="contact-map"
        src={`https://www.google.com/maps?q=${mapsDestination}&output=embed`}
        title={`Google Map of ${settings.address}`}
        loading="lazy"
      />
    </section>}
    {isDonate && <>
      <section className="support-options" aria-labelledby="support-options-title"><h2 id="support-options-title">There’s more than one way to show love.</h2><div className="support-option-grid"><article><h3>Give your time</h3><p>Learn about volunteering and the information available so far.</p><Link className="text-link" href="/info/volunteering">Explore volunteering <span aria-hidden="true">→</span></Link></article><article><h3>Find your companion</h3><p>Get to know the cats and dogs in our local demonstration catalog.</p><Link className="text-link" href="/animals">Meet the animals <span aria-hidden="true">→</span></Link></article></div></section>
    </>}
    {isContact && <div className="local-page-actions"><Link className="button" href="/info/adoption">Adoption information <span aria-hidden="true">→</span></Link><Link className="button secondary" href="/info/volunteering">Volunteering information <span aria-hidden="true">→</span></Link></div>}
    <div className="info-bottom">
      {!isDonate && <Link className="text-link" href={isContact ? '/animals' : '/contact'}>{isContact ? 'Meet available animals' : 'Contact Pets4Luv'} <span aria-hidden="true">→</span></Link>}
      <p className="small-note">Development demo · Animal profiles and sample information are fictional.</p>
    </div>
  </main>
}
