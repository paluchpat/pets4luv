import Link from 'next/link'
import { getHomepage } from '@/lib/content'
import { SearchPanel, ChatLauncher } from '@/components/SearchPanel'
import { PortraitPhoto } from '@/components/AnimalCard'
import { RichContent } from '@/components/RichContent'
import { HomeDonationImpact } from '@/components/HomeDonationImpact'
import styles from './HomeIntro.module.css'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const homepage = await getHomepage()
  const [spotlight, ...companions] = homepage.featuredAnimals
  return <main id="main">
    <section className="hero" aria-labelledby="hero-title"><picture><source media="(max-width: 680px)" srcSet="/images/hero-mobile.webp" /><img src="/images/hero-desktop.png" alt="A golden dog and tabby cat resting together on a soft blanket" fetchPriority="high" /></picture><div className="hero-copy"><h1 id="hero-title">Bringing families together</h1><p>One rescue at a time</p></div></section>
    <div className="home-content">
      <section className={styles.intro} aria-labelledby="foundation-title">
        <h2 id="foundation-title">{homepage.foundationIntro.heading}</h2>
        <RichContent value={homepage.foundationIntro.body} text={homepage.foundationIntro.bodyText} />
      </section>
      <section className="weekly" aria-labelledby="weekly-title"><div className="weekly-intro"><p className="section-label">Featured animals of the week</p><h2 id="weekly-title">{homepage.heading}</h2><RichContent value={homepage.intro} text={homepage.introText} /></div>
        {spotlight ? <article className="spotlight"><Link className="portrait-photo spotlight-photo" href={`/animals/${spotlight.slug}`} aria-label={`Meet ${spotlight.name}`}><PortraitPhoto animal={spotlight} /></Link><div className="spotlight-caption"><div><strong>{spotlight.name}</strong><span>This week’s spotlight</span></div><Link className="animal-meet-link" href={`/animals/${spotlight.slug}`}><span className="animal-meet-link-label">Meet {spotlight.name}</span><span aria-hidden="true">→</span></Link></div></article> : <p className="empty-state">Our next featured friends are on their way. <Link href="/animals">Explore available animals.</Link></p>}
        {companions.length > 0 && <div className="weekly-companions">{companions.map(animal => <article className="weekly-animal" key={animal.id}><Link href={`/animals/${animal.slug}`} className="portrait-photo weekly-animal-photo" aria-label={`Meet ${animal.name}`}><PortraitPhoto animal={animal} /></Link><div><h3><Link href={`/animals/${animal.slug}`}>{animal.name}</Link></h3>{animal.summary && <p>{animal.summary}</p>}<Link className="text-link animal-meet-link" href={`/animals/${animal.slug}`}><span className="animal-meet-link-label">Meet {animal.name}</span><span aria-hidden="true">→</span></Link></div></article>)}</div>}
      </section>
      <SearchPanel />
      <ChatLauncher />
      <HomeDonationImpact />
    </div>
  </main>
}
