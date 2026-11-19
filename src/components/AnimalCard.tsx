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
  const href = `/animals/${animal.slug}`

  return (
    <article className="animal-card">
      <Link href={href} className="animal-profile-link" aria-label={`View ${animal.name}’s adoption profile`}>
        <div className="animal-card-photo portrait-photo"><PortraitPhoto animal={animal} /></div>
        <h2>
          <span className="animal-profile-name">{animal.name}</span>
          <span className="animal-profile-arrow" aria-hidden="true">→</span>
        </h2>
      </Link>
      <div className="animal-card-body">
        <p className="animal-card-age animal-age-label">{animal.ageLabel || animal.ageGroup}</p>
        {animal.summary && <p>{animal.summary}</p>}
      </div>
    </article>
  )
}
