'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLayoutEffect, useOptimistic, useRef, useTransition, type FormEvent, type ReactNode } from 'react'
import { animalColorOptions, type AnimalColor } from '@/lib/animal-colors'
import { emptyGalleryFilters, galleryHref, galleryResultsHeadingId, gallerySortOptions, parseGallerySort, type GalleryFilters } from '@/lib/gallery-filters'
import { FilterSelect } from './FilterSelect'
import { Icon } from './Icons'
import { SpeciesPicker } from './SpeciesPicker'
import { ageOptions, genderOptions, sizeOptions } from './filter-options'

const colorSwatches: Record<AnimalColor, string> = {
  black: '#242023',
  brown: '#79503a',
  cream: '#f6e8cc',
  gold: '#c69833',
  gray: '#85838b',
  orange: '#e47d37',
  red: '#b83f38',
  tan: '#c9a679',
  white: '#ffffff',
}

const colorOptions = [
  { value: '', label: 'Any color' },
  ...animalColorOptions.map(option => ({ ...option, swatch: colorSwatches[option.value] })),
]

const selects = [
  { name: 'ageGroup', label: 'Age', options: ageOptions },
  { name: 'gender', label: 'Gender', options: genderOptions },
  { name: 'color', label: 'Color', options: colorOptions },
  { name: 'size', label: 'Size', options: sizeOptions },
] as const

const compatibility = [
  { name: 'goodWithDogs', label: 'Dogs', icon: 'dog' },
  { name: 'goodWithCats', label: 'Cats', icon: 'cat' },
  { name: 'goodWithChildren', label: 'Children', icon: 'child' },
] as const

export function GalleryFiltersForm({ filters, totalDocs, page, totalPages, children }: {
  filters: GalleryFilters
  totalDocs: number
  page: number
  totalPages: number
  children: ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic(filters)
  const [isSorting, setSorting] = useOptimistic(false)
  const latestFilters = useRef(applied)
  const searchInput = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<number | undefined>(undefined)
  const lastSubmittedQuery = useRef(filters.q)
  const pageToScroll = useRef<number | null>(null)
  const resultsTitle = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    function restoreSearchFromHistory() {
      pageToScroll.current = null
      window.clearTimeout(searchTimer.current)
      if (window.location.pathname !== '/animals' || !searchInput.current) return
      const queries = new URLSearchParams(window.location.search).getAll('q')
      const q = queries.length === 1 ? queries[0].slice(0, 200) : ''
      searchInput.current.value = q
      lastSubmittedQuery.current = q
    }

    window.addEventListener('popstate', restoreSearchFromHistory)
    return () => {
      window.removeEventListener('popstate', restoreSearchFromHistory)
      window.clearTimeout(searchTimer.current)
    }
  }, [])

  useLayoutEffect(() => {
    latestFilters.current = applied
    // Preserve typing while the current search or filter navigation is still in flight.
    if (!isPending && applied.q !== lastSubmittedQuery.current && searchInput.current) {
      window.clearTimeout(searchTimer.current)
      searchInput.current.value = applied.q
      lastSubmittedQuery.current = applied.q
    }
  }, [applied, isPending])

  useLayoutEffect(() => {
    const requestedPage = pageToScroll.current
    pageToScroll.current = null
    if (requestedPage !== filters.page || window.location.hash !== `#${galleryResultsHeadingId}`) return
    resultsTitle.current?.focus({ preventScroll: true })
    // Use the site's scroll behavior, including its reduced-motion override.
    document.getElementById(galleryResultsHeadingId)?.scrollIntoView()
  }, [filters])

  function pageLink(destination: number, label: string) {
    return <Link
      className="button secondary"
      href={`${galleryHref(filters, destination)}#${galleryResultsHeadingId}`}
      scroll={false}
      onNavigate={() => { pageToScroll.current = destination }}
    >{label}</Link>
  }

  function applyFilters(changes: Partial<GalleryFilters>) {
    pageToScroll.current = null
    // Merge into the latest selection even before Next commits its server response.
    const next = { ...latestFilters.current, ...changes, page: 1 }
    latestFilters.current = next
    startTransition(async () => {
      setApplied(next)
      if (changes.sort !== undefined) setSorting(true)
      router.push(galleryHref(next), { scroll: false })
      await new Promise<void>(resolve => window.setTimeout(resolve, 1500))
    })
  }

  function scheduleSearch(q: string) {
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = undefined
      if (q === latestFilters.current.q) return
      lastSubmittedQuery.current = q
      applyFilters({ q })
    }, 300)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.clearTimeout(searchTimer.current)
    const q = (searchInput.current?.value ?? '').slice(0, 200)
    lastSubmittedQuery.current = q
    applyFilters({ q })
  }

  return <>
    <form action="/animals" method="get" onSubmit={submitSearch}>
      <div className="gallery-filters">
        <SpeciesPicker showLabel value={applied.species} onValueChange={species => applyFilters({ species })} />
        {selects.map(({ name, label, options }) => <FilterSelect
          key={name}
          label={label}
          name={name}
          options={options}
          value={applied[name]}
          onValueChange={value => applyFilters({ [name]: value })}
        />)}
        <label className="search-text">
          <span className="filter-field-label">Additional details</span>
          <input ref={searchInput} name="q" type="search" placeholder="Name, breed, description" defaultValue={filters.q} maxLength={200} onChange={event => scheduleSearch(event.currentTarget.value.slice(0, 200))} />
        </label>
        <div className="gallery-filter-footer">
          <fieldset className="compatibility-filters">
            <legend>Friendly with</legend>
            {compatibility.map(({ name, label, icon }) => <label key={name}>
              <input className="sr-only" type="checkbox" name={name} value="true" checked={applied[name]} onChange={event => applyFilters({ [name]: event.currentTarget.checked })} />
              <Icon kind={icon} />
              {label}
            </label>)}
          </fieldset>
          <div className="filter-actions">
            <noscript><button type="submit" className="button">Apply filters</button></noscript>
            <Link href={galleryHref({ ...emptyGalleryFilters, sort: applied.sort })} scroll={false} onNavigate={event => {
              event.preventDefault()
              window.clearTimeout(searchTimer.current)
              if (searchInput.current) searchInput.current.value = ''
              lastSubmittedQuery.current = ''
              applyFilters(emptyGalleryFilters)
            }}>Clear filters</Link>
          </div>
        </div>
        <GalleryStatus variant="filters" pending={isPending && !isSorting} />
      </div>
      <p className="gallery-listing-links">
        You can also find our adoptable animals on{' '}
        <a
          href="https://www.petfinder.com/search/cats-for-adoption/?shelterRescue=521e2d23-2a7e-4a1d-8a22-b6c7e0acf003&includeOutOfTown=true"
          target="_blank"
          rel="noopener noreferrer"
        >
          Petfinder
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {' and '}
        <a
          href="https://www.adoptapet.com/shelter/89959-pets4luv-foundation-hicksville-new-york"
          target="_blank"
          rel="noopener noreferrer"
        >
          Adopt a pet
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      <div id={galleryResultsHeadingId} className="results-heading">
        <h2 ref={resultsTitle} tabIndex={-1} aria-live="polite">{totalDocs} {totalDocs === 1 ? 'friend' : 'friends'} waiting to meet you</h2>
        <FilterSelect
          className="gallery-sort"
          label="Sort by"
          name="sort"
          options={gallerySortOptions}
          value={applied.sort}
          onValueChange={value => applyFilters({ sort: parseGallerySort(value) })}
        />
      </div>
    </form>
    <div className="gallery-results">
      <div inert={isSorting}>
        {children}
        {totalPages > 1 && <nav className="pagination" aria-label="Results pages">
          {page > 1 && pageLink(page - 1, '← Previous')}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && pageLink(page + 1, 'Next →')}
        </nav>}
      </div>
      <GalleryStatus variant="sort" pending={isSorting} />
    </div>
  </>
}

const galleryStatusVariants = {
  filters: { className: 'gallery-status', message: 'Looking for friends…', image: 'gallery-cat', width: 64, height: 40 },
  sort: { className: 'gallery-sort-status', message: 'Sorting results…', image: 'gallery-cat-sort', width: 768, height: 456 },
} as const

function GalleryStatus({ variant, pending }: { variant: keyof typeof galleryStatusVariants; pending: boolean }) {
  const { className, message, image, width, height } = galleryStatusVariants[variant]
  return <div className={className} role="status">
    {pending && <>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={`/images/${image}-static.png`} />
        <img src={`/images/${image}.apng`} alt="" width={width} height={height} />
      </picture>
      <span>{message}</span>
    </>}
  </div>
}
