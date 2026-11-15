import type { Metadata } from 'next'
import Link from 'next/link'
import { searchAnimals } from '@/lib/content'
import { AnimalCard } from '@/components/AnimalCard'
import { GalleryFiltersForm } from '@/components/GalleryFiltersForm'
import { galleryHref, type GalleryFilters } from '@/lib/gallery-filters'

export const metadata: Metadata = { title: 'Find your companion' }
export const dynamic = 'force-dynamic'
type Params = Record<string, string | string[] | undefined>

function single(value: string | string[] | undefined) { return typeof value === 'string' ? value : '' }
function allowed(value: string, values: string[]) { return values.includes(value) ? value : '' }

export default async function AnimalsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const filters: GalleryFilters = {
    q: single(params.q).slice(0, 200),
    species: allowed(single(params.species), ['cat', 'dog']),
    ageGroup: allowed(single(params.ageGroup), ['baby', 'young', 'adult', 'senior']),
    size: allowed(single(params.size), ['small', 'medium', 'large']),
    sex: allowed(single(params.sex), ['female', 'male']),
    goodWithDogs: single(params.goodWithDogs) === 'true',
    goodWithCats: single(params.goodWithCats) === 'true',
    goodWithChildren: single(params.goodWithChildren) === 'true',
    page: Math.max(1, Number.parseInt(single(params.page), 10) || 1),
  }
  const animals = await searchAnimals(filters)
  return <main id="main" className="page-shell gallery-page"><div className="page-intro"><p className="section-label">A new chapter starts here</p><h1>Find your companion</h1><p>Every animal has a story. Find an available cat or dog who could be part of yours.</p></div>
    <GalleryFiltersForm filters={filters} />
    <div className="results-heading" aria-live="polite"><h2>{animals.totalDocs} {animals.totalDocs === 1 ? 'friend' : 'friends'} waiting to meet you</h2><p>Currently available animals</p></div>
    {animals.docs.length ? <div className="animal-grid">{animals.docs.map(animal => <AnimalCard key={animal.id} animal={animal} />)}</div> : <div className="empty-state"><h2>No companions match these filters yet.</h2><p>Try adjusting your search, or check back as new animals become available.</p><Link className="text-link" href="/animals">See all available animals →</Link></div>}
    {animals.totalPages > 1 && <nav className="pagination" aria-label="Results pages">{animals.page > 1 && <Link className="button secondary" href={galleryHref(filters, animals.page - 1)}>← Previous</Link>}<span>Page {animals.page} of {animals.totalPages}</span>{animals.page < animals.totalPages && <Link className="button secondary" href={galleryHref(filters, animals.page + 1)}>Next →</Link>}</nav>}
  </main>
}
