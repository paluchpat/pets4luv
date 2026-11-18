import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { draftMode } from 'next/headers'
import { Header } from '@/components/Header'
import { PreviewRefresh } from '@/components/PreviewRefresh'
import { SocialLinks } from '@/components/SocialLinks'
import { getMainMenu, getWebsiteSettings } from '@/lib/content'
import { phoneHref } from '@/lib/website-settings'
import { homeDescription, homeTitle, metadataBase, noIndex, publicSiteOrigin } from '@/lib/seo'
import './site.css'

export async function generateMetadata(): Promise<Metadata> {
  const preview = (await draftMode()).isEnabled
  return {
    metadataBase,
    title: { default: homeTitle, template: '%s · Pets4Luv' },
    description: homeDescription,
    ...((!publicSiteOrigin || preview) && { robots: noIndex }),
  }
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [mode, settings, menu] = await Promise.all([draftMode(), getWebsiteSettings(), getMainMenu()])
  const preview = mode.isEnabled
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
    <a className="skip-link" href="#main">Skip to content</a>{preview && <><PreviewRefresh /><div className="preview-banner" role="status"><strong>Draft preview</strong><span>You are viewing unpublished website changes.</span><a href="/api/exit-preview">Exit preview</a></div></>}<Header menu={menu} />{children}
    <footer className="site-footer">
      <div>
        <Link href="/" className="footer-name">Pets4Luv Foundation</Link>
        <p>Bringing families together. One rescue at a time.</p>
        <address>{settings.address}</address>
        <p><a href={phoneHref(settings.phone)} aria-label={`Call Pets4Luv at ${settings.phone}`}>{settings.phone}</a></p>
        <SocialLinks settings={settings} />
      </div>
      <nav aria-label="Footer navigation">
        {menu.footerLinks.map(({ id, href, label, newTab }) => <Link key={id} href={href} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined}>{label}{newTab && <span className="sr-only"> (opens in a new tab)</span>}</Link>)}
      </nav>
      {!publicSiteOrigin && <p className="demo-notice">Development preview. Please confirm adoption details with Pets4Luv.</p>}
    </footer>
  </body></html>
}
