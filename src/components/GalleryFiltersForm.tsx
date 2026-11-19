'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLayoutEffect, useOptimistic, useRef, useTransition, type FormEvent, type ReactNode } from 'react'
import { animalColorOptions, type AnimalColor } from '@/lib/animal-colors'
import { emptyGalleryFilters, galleryHref, galleryResultsHeadingId, gallerySearchMaxLength, gallerySortOptions, parseGallerySort, type GalleryFilters } from '@/lib/gallery-filters'
import { FilterSelect } from './FilterSelect'
import { Icon } from './Icons'
import { SpeciesPicker } from './SpeciesPicker'
import { ageOptions, genderOptions, sizeOptions } from './filter-options'

const colorSwatches: Record<AnimalColor, string> = {
  black: '#242023',
  brown: '#79503a',
  calico: 'linear-gradient(90deg, #e47d37 0% 33.333%, #ffffff 33.333% 66.667%, #242023 66.667% 100%)',
  cream: '#f6e8cc',
  gold: '#c69833',
  gray: '#85838b',
  orange: '#e47d37',
  red: '#b83f38',
  tan: '#c9a679',
  tuxedo: 'linear-gradient(90deg, #242023 50%, #ffffff 50%) no-repeat border-box',
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

type GalleryLoadingMode = 'search' | 'sort'

function scrollToGalleryResults(title: HTMLHeadingElement | null) {
  title?.focus({ preventScroll: true })
  // Use the site's scroll behavior, including its reduced-motion override.
  document.getElementById(galleryResultsHeadingId)?.scrollIntoView()
}

export function GalleryFiltersForm({ filters, totalDocs, page, totalPages, directoryLinks, children }: {
  filters: GalleryFilters
  totalDocs: number
  page: number
  totalPages: number
  directoryLinks: ReactNode
  children: ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic(filters)
  const [loadingMode, setLoadingMode] = useOptimistic<GalleryLoadingMode | null>(null)
  const latestFilters = useRef(applied)
  const searchInput = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<number | undefined>(undefined)
  const lastSubmittedQuery = useRef(filters.q)
  const pageToScroll = useRef<number | null>(null)
  const resultsTitle = useRef<HTMLHeadingElement>(null)
  const allAnimalsHref = galleryHref({ ...emptyGalleryFilters, sort: applied.sort })

  useLayoutEffect(() => {
    function restoreSearchFromHistory() {
      pageToScroll.current = null
      window.clearTimeout(searchTimer.current)
      if (window.location.pathname !== '/animals' || !searchInput.current) return
      const queries = new URLSearchParams(window.location.search).getAll('q')
      const q = queries.length === 1 ? queries[0].slice(0, gallerySearchMaxLength) : ''
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
    scrollToGalleryResults(resultsTitle.current)
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
      setLoadingMode(changes.sort === undefined ? 'search' : 'sort')
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
    const q = (searchInput.current?.value ?? '').slice(0, gallerySearchMaxLength)
    lastSubmittedQuery.current = q
    applyFilters({ q })
  }

  function clearSearchInput() {
    window.clearTimeout(searchTimer.current)
    searchTimer.current = undefined
    if (searchInput.current) searchInput.current.value = ''
    lastSubmittedQuery.current = ''
  }

  return <>
    <form action="/animals" method="get" onSubmit={submitSearch}>
      <div className="gallery-filters">
        <div className="search-text">
          <label className="filter-field-label" htmlFor="animal-search-details">Additional details</label>
          <input
            ref={searchInput}
            id="animal-search-details"
            name="q"
            type="search"
            placeholder="Name, breed, or traits"
            aria-describedby="animal-search-help"
            defaultValue={filters.q}
            maxLength={gallerySearchMaxLength}
            onChange={event => scheduleSearch(event.currentTarget.value.slice(0, gallerySearchMaxLength))}
          />
          <p id="animal-search-help">Try <strong>small black cat</strong>. Use quotes to search for a name or phrase in the profile text.</p>
        </div>
        <SpeciesPicker showLabel value={applied.species} onValueChange={species => applyFilters({ species })} />
        {selects.map(({ name, label, options }) => <FilterSelect
          key={name}
          label={label}
          name={name}
          options={options}
          value={applied[name]}
          onValueChange={value => applyFilters({ [name]: value })}
        />)}
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
            <Link href={allAnimalsHref} scroll={false} onNavigate={event => {
              event.preventDefault()
              clearSearchInput()
              applyFilters(emptyGalleryFilters)
            }}>Clear filters</Link>
            <Link
              className="button"
              href={`#${galleryResultsHeadingId}`}
              prefetch={false}
              onNavigate={event => {
                event.preventDefault()
                scrollToGalleryResults(resultsTitle.current)
              }}
            >Show results</Link>
          </div>
        </div>
        <GalleryStatus variant="filters" loadingMode={loadingMode === 'search' ? loadingMode : null} />
      </div>
      {directoryLinks}
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
      <div inert={loadingMode !== null}>
        {children ?? <div className="empty-state">
          <h2>No companions match these filters yet.</h2>
          <p>Try adjusting your search, or check back as new animals become available.</p>
          <Link
            className="text-link"
            href={`${allAnimalsHref}#${galleryResultsHeadingId}`}
            scroll={false}
            onNavigate={event => {
              clearSearchInput()
              if (`${window.location.pathname}${window.location.search}` === allAnimalsHref) {
                event.preventDefault()
                pageToScroll.current = null
                scrollToGalleryResults(resultsTitle.current)
                return
              }
              pageToScroll.current = 1
            }}
          >See all available animals →</Link>
        </div>}
        {totalPages > 1 && <nav className="pagination" aria-label="Results pages">
          {page > 1 && pageLink(page - 1, '← Previous')}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && pageLink(page + 1, 'Next →')}
        </nav>}
      </div>
      <GalleryStatus variant="results" loadingMode={loadingMode} />
    </div>
  </>
}

const galleryStatusVariants = {
  filters: { className: 'gallery-status', image: 'gallery-cat', width: 64, height: 40 },
  results: { className: 'gallery-results-status', image: 'gallery-cat-sort', width: 768, height: 456 },
} as const

function GalleryStatus({ variant, loadingMode }: { variant: keyof typeof galleryStatusVariants; loadingMode: GalleryLoadingMode | null }) {
  const { className, image, width, height } = galleryStatusVariants[variant]
  const isInline = variant === 'filters'
  return <div className={className} role={isInline ? undefined : 'status'} aria-hidden={isInline || undefined}>
    {loadingMode && <>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={`/images/${image}-static.png`} />
        <img src={`/images/${image}.apng`} alt="" width={width} height={height} />
      </picture>
      <span>{loadingMode === 'sort' ? 'Sorting results…' : 'Looking for friends…'}</span>
    </>}
  </div>
}
