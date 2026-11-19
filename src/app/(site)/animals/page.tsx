import Link from 'next/link'
import { isAnimalColor } from '@/lib/animal-colors'
import { getWebsiteSettings, searchAnimals } from '@/lib/content'
import { AdoptionDirectoryLinks } from '@/components/AdoptionDirectoryLinks'
import { AnimalCard } from '@/components/AnimalCard'
import { GalleryFiltersForm } from '@/components/GalleryFiltersForm'
import { galleryHref, gallerySearchMaxLength, parseGallerySort, type GalleryFilters } from '@/lib/gallery-filters'
import { pageMetadata } from '@/lib/seo'
import { siteLinks } from '@/lib/site-navigation'

export const dynamic = 'force-dynamic'
type Params = Record<string, string | string[] | undefined>
type Props = { searchParams: Promise<Params> }

function single(value: string | string[] | undefined) { return typeof value === 'string' ? value : '' }
function allowed(value: string, values: string[]) { return values.includes(value) ? value : '' }

function galleryFilters(params: Params): GalleryFilters {
  return {
    q: single(params.q).trim().slice(0, gallerySearchMaxLength),
    species: allowed(single(params.species), ['cat', 'dog']),
    ageGroup: allowed(single(params.ageGroup), ['baby', 'young', 'adult', 'senior']),
    size: allowed(single(params.size), ['small', 'medium', 'large']),
    gender: allowed(single(params.gender ?? params.sex), ['female', 'male']),
    color: isAnimalColor(params.color) ? params.color : '',
    goodWithDogs: single(params.goodWithDogs) === 'true',
    goodWithCats: single(params.goodWithCats) === 'true',
    goodWithChildren: single(params.goodWithChildren) === 'true',
    sort: parseGallerySort(params.sort),
    page: Math.min(10000, Math.max(1, Number.parseInt(single(params.page), 10) || 1)),
  }
}

export async function generateMetadata({ searchParams }: Props) {
  const filters = galleryFilters(await searchParams)
  const hasFilters = galleryHref(filters, 1) !== '/animals'
  const pageSuffix = !hasFilters && filters.page > 1 ? ` | Page ${filters.page}` : ''
  return pageMetadata({
    title: 'Adoptable cats and dogs' + pageSuffix,
    description: 'Meet the cats and dogs available for adoption at Pets4Luv Foundation in Freeport, NY.',
    path: hasFilters ? '/animals' : galleryHref(filters),
    indexable: !hasFilters,
  })
}

export default async function AnimalsPage({ searchParams }: Props) {
  const filters = galleryFilters(await searchParams)
  const { gender, sort, ...searchFilters } = filters
  const [animals, settings] = await Promise.all([searchAnimals({ ...searchFilters, sex: gender }, sort), getWebsiteSettings()])
  return <main id="main" className="page-shell gallery-page"><div className="page-intro"><p className="section-label">A new chapter starts here</p><h1>Find your companion</h1><p>Every animal has a story. Find an available cat or dog who could be part of yours. Ready to adopt? <Link href={siteLinks.adoption.href}>Learn how adoption works</Link>.</p></div>
    <GalleryFiltersForm directoryLinks={<AdoptionDirectoryLinks settings={settings} />} filters={filters} totalDocs={animals.totalDocs} page={animals.page} totalPages={animals.totalPages}>
      {animals.docs.length ? <div className="animal-grid">{animals.docs.map(animal => <AnimalCard key={animal.id} animal={animal} />)}</div> : null}
    </GalleryFiltersForm>
  </main>
}
