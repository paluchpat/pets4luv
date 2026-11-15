import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPage } from '@/lib/content'
import { RichContent } from '@/components/RichContent'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage((await params).slug)
  return { title: page?.title || 'Page not found' }
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()
  const isDonate = slug === 'donate'
  const isContact = slug === 'contact'

  return <main id="main" className={`page-shell information-page content-page${isDonate ? ' donation-page' : ''}`}>
    <p className="section-label">{isDonate ? 'Every bit of kindness matters' : isContact ? 'Let’s connect' : 'Pets4Luv information'}</p>
    <h1>{page.title}</h1>
    {isDonate && <section className="donation-options" aria-labelledby="donation-options-title">
      <h2 id="donation-options-title">Help bring families together.</h2>
      <p>Your generosity helps us continue to <strong>“bring families together one rescue at a time.”</strong></p>
      <div className="donation-actions">
        <a className="button" href="https://www.zeffy.com/en-US/donation-form/help-needed-for-medical-costs" target="_blank" rel="noopener noreferrer">
          Donate with Zeffy <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a className="button secondary" href="https://www.paypal.com/paypalme/pets4luvfoundation" target="_blank" rel="noopener noreferrer">
          PayPal <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a className="button secondary" href="https://venmo.com/pets4luv" target="_blank" rel="noopener noreferrer">
          Venmo @pets4luv <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <div className="donation-mail">
        <h3>Mail a check</h3>
        <address>2 Rider Place, Freeport, NY 11520</address>
      </div>
    </section>}
    <RichContent value={page.body} text={page.bodyText} />
    {isDonate && <>
      <section className="support-options" aria-labelledby="support-options-title"><h2 id="support-options-title">There’s more than one way to show love.</h2><div className="support-option-grid"><article><h3>Give your time</h3><p>Learn about volunteering and the information available so far.</p><Link className="text-link" href="/info/volunteering">Explore volunteering <span aria-hidden="true">→</span></Link></article><article><h3>Find your companion</h3><p>Get to know the cats and dogs in our local demonstration catalog.</p><Link className="text-link" href="/animals">Meet the animals <span aria-hidden="true">→</span></Link></article></div></section>
    </>}
    {isContact && <div className="local-page-actions"><Link className="button" href="/info/adoption">Adoption information <span aria-hidden="true">→</span></Link><Link className="button secondary" href="/info/volunteering">Volunteering information <span aria-hidden="true">→</span></Link></div>}
    <div className="info-bottom">
      {!isDonate && <Link className="text-link" href={isContact ? '/animals' : '/contact'}>{isContact ? 'Meet available animals' : 'Contact Pets4Luv'} <span aria-hidden="true">→</span></Link>}
      <p className="small-note">Local development demo · Animal profiles and sample information are fictional.</p>
    </div>
  </main>
}
