import Link from 'next/link'
import { getHomepage, type AnimalDTO } from '@/lib/content'
import { SearchPanel, ChatLauncher } from '@/components/SearchPanel'
import { AnimalPhoto } from '@/components/AnimalCard'
import { RichContent } from '@/components/RichContent'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const homepage = await getHomepage()
  const [spotlight, ...companions] = homepage.featuredAnimals
  return <main id="main">
    <section className="hero" aria-labelledby="hero-title"><picture><source media="(max-width: 680px)" srcSet="/images/hero-mobile.png" /><img src="/images/hero-desktop.png" alt="A golden dog and tabby cat resting together on a soft blanket" fetchPriority="high" /></picture><div className="hero-copy"><h1 id="hero-title">Bringing families together</h1><p>One rescue at a time</p></div></section>
    <div className="home-content"><SearchPanel />
      <section className="weekly" aria-labelledby="weekly-title"><div className="weekly-intro"><p className="section-label">Featured animals of the week</p><h2 id="weekly-title">{homepage.heading}</h2><RichContent value={homepage.intro} text={homepage.introText} /></div>
        {spotlight ? <article className="spotlight"><Link className="spotlight-photo" href={`/animals/${spotlight.slug}`} aria-label={`Meet ${spotlight.name}`}><FeaturedAnimalPhoto animal={spotlight} /></Link><div className="spotlight-caption"><div><strong>{spotlight.name}</strong><span>This week’s spotlight</span></div><Link className="animal-meet-link" href={`/animals/${spotlight.slug}`}><span className="animal-meet-link-label">Meet {spotlight.name}</span><span aria-hidden="true">→</span></Link></div></article> : <p className="empty-state">Our next featured friends are on their way. <Link href="/animals">Explore available animals.</Link></p>}
        {companions.length > 0 && <div className="weekly-companions">{companions.map(animal => <article className="weekly-animal" key={animal.id}><Link href={`/animals/${animal.slug}`} className="weekly-animal-photo" aria-label={`Meet ${animal.name}`}><FeaturedAnimalPhoto animal={animal} /></Link><div><h3><Link href={`/animals/${animal.slug}`}>{animal.name}</Link></h3><p>{animal.summary}</p><Link className="text-link animal-meet-link" href={`/animals/${animal.slug}`}><span className="animal-meet-link-label">Meet {animal.name}</span><span aria-hidden="true">→</span></Link></div></article>)}</div>}
      </section><div className="home-end"><p>Sample animals · Local demo</p><ChatLauncher /></div>
    </div>
  </main>
}

function FeaturedAnimalPhoto({ animal }: { animal: AnimalDTO }) {
  return <>
    {animal.photo && <img className="weekly-photo-backdrop" src={animal.photo.url} alt="" loading="lazy" />}
    <AnimalPhoto animal={animal} />
  </>
}
