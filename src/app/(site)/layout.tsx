import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { draftMode } from 'next/headers'
import { Header } from '@/components/Header'
import { PreviewRefresh } from '@/components/PreviewRefresh'
import { SocialLinks } from '@/components/SocialLinks'
import { pets4LuvAddress } from '@/lib/site-address'
import { siteLinks } from '@/lib/site-navigation'
import './site.css'

export const metadata: Metadata = { title: { default: 'Pets4Luv · Bringing families together', template: '%s · Pets4Luv' }, description: 'Find your new companion. Explore adoptable cats and dogs and learn about Pets4Luv.' }

const footerLinks = [
  siteLinks.adopt,
  siteLinks.adoption,
  siteLinks.applications,
  siteLinks.volunteer,
  siteLinks.about,
  siteLinks.donate,
  siteLinks.contact,
]

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const preview = (await draftMode()).isEnabled
  return <html lang="en" data-scroll-behavior="smooth"><body>
    {!preview && <Script id="google-tag-manager" strategy="afterInteractive">{`
      (() => {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-MBBK534D';
        document.head.appendChild(script);
      })();
    `}</Script>}
    <a className="skip-link" href="#main">Skip to content</a>{preview && <><PreviewRefresh /><div className="preview-banner" role="status"><strong>Draft preview</strong><span>You are viewing unpublished homepage changes.</span><a href="/api/exit-preview">Exit preview</a></div></>}<Header />{children}
    <footer className="site-footer">
      <div>
        <Link href="/" className="footer-name">Pets4Luv Foundation</Link>
        <p>Bringing families together. One rescue at a time.</p>
        <address>{pets4LuvAddress}</address>
        <SocialLinks />
      </div>
      <nav aria-label="Footer navigation">
        {footerLinks.map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <p className="demo-notice">Development demo · Animal profiles and sample information are fictional. This is not the rescue’s live adoption catalog.</p>
    </footer>
  </body></html>
}
