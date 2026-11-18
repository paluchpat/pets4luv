import Link from 'next/link'
import type { AnimalDTO } from '@/lib/content'

export function AnimalPhoto({ animal, className = '' }: { animal: AnimalDTO; className?: string }) {
  return animal.photo ? <img className={className} src={animal.photo.url} alt={animal.photo.alt || animal.name} loading="lazy" /> : <div className={`missing-photo ${className}`} role="img" aria-label={`Photo of ${animal.name} not yet available`}>Photo coming soon</div>
}

export function PortraitPhoto({ animal }: { animal: AnimalDTO }) {
  return <>
    {animal.photo && <img className="portrait-photo-backdrop" src={animal.photo.url} alt="" loading="lazy" />}
    <AnimalPhoto animal={animal} className="portrait-photo-image" />
  </>
}

export function AnimalCard({ animal }: { animal: AnimalDTO }) {
  return <article className="animal-card"><Link href={`/animals/${animal.slug}`} className="animal-card-photo portrait-photo"><PortraitPhoto animal={animal} /></Link><div className="animal-card-body"><p className="eyebrow">{animal.species === 'cat' ? 'Cat' : 'Dog'} · {animal.ageLabel || animal.ageGroup}{animal.size && <> · {animal.size}</>}</p><h2><Link href={`/animals/${animal.slug}`}>{animal.name}</Link></h2>{animal.summary && <p>{animal.summary}</p>}<Link className="text-link animal-meet-link" href={`/animals/${animal.slug}`}><span className="animal-meet-link-label">Meet {animal.name}</span>{' '}<span aria-hidden="true">→</span></Link></div></article>
}
