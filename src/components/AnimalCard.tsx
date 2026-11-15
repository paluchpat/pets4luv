import Link from 'next/link'
import type { AnimalDTO } from '@/lib/content'

export function AnimalPhoto({ animal, className = '' }: { animal: AnimalDTO; className?: string }) {
  return animal.photo ? <img className={className} src={animal.photo.url} alt={animal.photo.alt || animal.name} loading="lazy" /> : <div className={`missing-photo ${className}`} role="img" aria-label={`Photo of ${animal.name} not yet available`}>Photo coming soon</div>
}

export function AnimalCard({ animal }: { animal: AnimalDTO }) {
  return <article className="animal-card"><Link href={`/animals/${animal.slug}`} className="animal-card-photo"><AnimalPhoto animal={animal} /></Link><div className="animal-card-body"><p className="eyebrow">{animal.species === 'cat' ? 'Cat' : 'Dog'} · {animal.ageLabel || animal.ageGroup} · {animal.size}</p><h2><Link href={`/animals/${animal.slug}`}>{animal.name}</Link></h2><p>{animal.summary}</p><Link className="text-link" href={`/animals/${animal.slug}`}>Meet {animal.name} <span aria-hidden="true">→</span></Link></div></article>
}
