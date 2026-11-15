import type { Metadata } from 'next'
import Link from 'next/link'
import { isAnimalColor } from '@/lib/animal-colors'
import { searchAnimals } from '@/lib/content'
import { AnimalCard } from '@/components/AnimalCard'
import { GalleryFiltersForm } from '@/components/GalleryFiltersForm'
import { emptyGalleryFilters, galleryHref, parseGallerySort, type GalleryFilters } from '@/lib/gallery-filters'
import { siteLinks } from '@/lib/site-navigation'

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
    gender: allowed(single(params.gender ?? params.sex), ['female', 'male']),
    color: isAnimalColor(params.color) ? params.color : '',
    goodWithDogs: single(params.goodWithDogs) === 'true',
    goodWithCats: single(params.goodWithCats) === 'true',
    goodWithChildren: single(params.goodWithChildren) === 'true',
    sort: parseGallerySort(params.sort),
    page: Math.max(1, Number.parseInt(single(params.page), 10) || 1),
  }
  const { gender, sort, ...searchFilters } = filters
  const animals = await searchAnimals({ ...searchFilters, sex: gender }, sort)
  return <main id="main" className="page-shell gallery-page"><div className="page-intro"><p className="section-label">A new chapter starts here</p><h1>Find your companion</h1><p>Every animal has a story. Find an available cat or dog who could be part of yours. To learn about our adoption process please read <Link href={siteLinks.adoption.href}>{siteLinks.adoption.label}</Link> page</p></div>
    <GalleryFiltersForm filters={filters} totalDocs={animals.totalDocs} page={animals.page} totalPages={animals.totalPages}>
      {animals.docs.length ? <div className="animal-grid">{animals.docs.map(animal => <AnimalCard key={animal.id} animal={animal} />)}</div> : <div className="empty-state"><h2>No companions match these filters yet.</h2><p>Try adjusting your search, or check back as new animals become available.</p><Link className="text-link" href={galleryHref({ ...emptyGalleryFilters, sort: filters.sort })}>See all available animals →</Link></div>}
    </GalleryFiltersForm>
  </main>
}
