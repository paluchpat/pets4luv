import Link from 'next/link'
import { getHomepage, getWebsiteSettings } from '@/lib/content'
import { homeDescription, homeTitle, homepageStructuredData, pageMetadata } from '@/lib/seo'
import { SearchPanel, ChatLauncher } from '@/components/SearchPanel'
import { PortraitPhoto } from '@/components/AnimalCard'
import { RichContent } from '@/components/RichContent'
import { HomeDonationImpact } from '@/components/HomeDonationImpact'
import styles from './HomeIntro.module.css'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata({ title: homeTitle, description: homeDescription, path: '/' })

export default async function HomePage() {
  const [homepage, settings] = await Promise.all([getHomepage(), getWebsiteSettings()])
  const structuredData = JSON.stringify(homepageStructuredData(settings)).replace(/</g, '\\u003c')
  const [spotlight, ...companions] = homepage.featuredAnimals
  return <main id="main">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    <section className="hero" aria-labelledby="hero-title">
      <picture>
        <source media="(max-width: 680px)" srcSet="/images/hero-mobile.webp" />
        <img src="/images/hero-desktop.png" alt="A golden dog and tabby cat resting together on a soft blanket" fetchPriority="high" />
      </picture>
      <div className="hero-copy">
        <h1 id="hero-title">{homepage.foundationIntro.heading}</h1>
        <p className="hero-tagline">Bringing families together<br />one rescue at a time</p>
      </div>
    </section>
    <div className="home-content">
      <section className={styles.intro} aria-label="About the foundation">
        <RichContent value={homepage.foundationIntro.body} text={homepage.foundationIntro.bodyText} />
      </section>
      <section className="weekly" aria-labelledby="weekly-title">
        <div className="weekly-intro">
          <p className="section-label">Featured animals of the week</p>
          <h2 id="weekly-title">{homepage.heading}</h2>
          <RichContent value={homepage.intro} text={homepage.introText} />
        </div>
        {spotlight ? (
          <Link className="spotlight weekly-profile-link" href={`/animals/${spotlight.slug}`}
            aria-label={`View ${spotlight.name}’s adoption profile`}
            aria-describedby={spotlight.summary ? 'spotlight-summary' : undefined}>
            <div className="portrait-photo spotlight-photo"><PortraitPhoto animal={spotlight} /></div>
            <div className="spotlight-caption">
              <h3>
                <span className="weekly-profile-name">{spotlight.name}</span>
                <span className="weekly-profile-arrow" aria-hidden="true">→</span>
              </h3>
              {spotlight.summary && <p id="spotlight-summary">{spotlight.summary}</p>}
            </div>
          </Link>
        ) : <p className="empty-state">Our next featured friends are on their way. <Link href="/animals">Explore available animals.</Link></p>}
        {companions.length > 0 && (
          <div className="weekly-companions">
            {companions.map((animal, index) => (
              <Link className="weekly-animal weekly-profile-link" key={animal.id} href={`/animals/${animal.slug}`}
                aria-label={`View ${animal.name}’s adoption profile`}
                aria-describedby={animal.summary ? `weekly-summary-${index}` : undefined}>
                <div className="portrait-photo weekly-animal-photo"><PortraitPhoto animal={animal} /></div>
                <div>
                  <h3>
                    <span className="weekly-profile-name">{animal.name}</span>
                    <span className="weekly-profile-arrow" aria-hidden="true">→</span>
                  </h3>
                  {animal.summary && <p id={`weekly-summary-${index}`}>{animal.summary}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <SearchPanel />
      <ChatLauncher />
      <HomeDonationImpact />
    </div>
  </main>
}
