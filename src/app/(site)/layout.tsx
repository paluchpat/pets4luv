import { Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { draftMode, headers } from 'next/headers'
import { Header } from '@/components/Header'
import { PreviewRefresh } from '@/components/PreviewRefresh'
import { SocialLinks } from '@/components/SocialLinks'
import { getMainMenu, getWebsiteSettings } from '@/lib/content'
import { phoneHref } from '@/lib/website-settings'
import { homeDescription, homeTitle, metadataBase, noIndex, publicSiteOrigin } from '@/lib/seo'
import './site.css'

export async function generateMetadata(): Promise<Metadata> {
  const preview = (await draftMode()).isEnabled || (await headers()).has('x-pets4luv-featured-preview')
  return {
    metadataBase,
    title: { default: homeTitle, template: '%s · Pets4Luv' },
    description: homeDescription,
    ...((!publicSiteOrigin || preview) && { robots: noIndex }),
  }
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const sharedPreview = (await headers()).has('x-pets4luv-featured-preview')
  const [mode, settings, menu] = await Promise.all([draftMode(), getWebsiteSettings(sharedPreview), getMainMenu(sharedPreview)])
  const preview = mode.isEnabled && !sharedPreview
  return <html lang="en" data-scroll-behavior="smooth"><body>
    {!preview && !sharedPreview && <Script id="google-tag-manager" strategy="afterInteractive">{`
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
    <a className="skip-link" href="#main">Skip to content</a>{preview && <><PreviewRefresh /><div className="preview-banner" role="status"><strong>Draft preview</strong><span>You are viewing unpublished website changes.</span><a href="/api/exit-preview">Exit preview</a></div></>}<Header menu={menu} />{children}
    <footer className="site-footer">
      <div>
        <Link href="/" className="footer-name">Pets4Luv Foundation</Link>
        <p>Bringing families together. One rescue at a time.</p>
        <address>{settings.address}</address>
        <div className="footer-contact">
          <a className="footer-phone" href={phoneHref(settings.phone)} aria-label={`Call Pets4Luv at ${settings.phone}`}>
            <Phone aria-hidden="true" focusable="false" />
            <span>{settings.phone}</span>
          </a>
          <SocialLinks settings={settings} />
        </div>
      </div>
      <nav aria-label="Footer navigation">
        {menu.footerLinks.map(({ id, href, label, newTab }) => <Link key={id} href={href} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined}>{label}{newTab && <span className="sr-only"> (opens in a new tab)</span>}</Link>)}
      </nav>
    </footer>
  </body></html>
}
