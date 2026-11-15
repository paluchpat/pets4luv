'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLayoutEffect, useOptimistic, useRef, useTransition, type FormEvent } from 'react'
import { emptyGalleryFilters, galleryHref, type GalleryFilters } from '@/lib/gallery-filters'
import { FilterSelect } from './FilterSelect'
import { SpeciesPicker } from './SpeciesPicker'
import { ageOptions, sexOptions, sizeOptions } from './filter-options'

const selects = [
  { name: 'ageGroup', label: 'Age', options: ageOptions },
  { name: 'sex', label: 'Sex', options: sexOptions },
  { name: 'size', label: 'Size', options: sizeOptions },
] as const

const compatibility = [
  { name: 'goodWithDogs', label: 'Dogs' },
  { name: 'goodWithCats', label: 'Cats' },
  { name: 'goodWithChildren', label: 'Children' },
] as const

export function GalleryFiltersForm({ filters }: { filters: GalleryFilters }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [applied, setApplied] = useOptimistic(filters)
  const latestFilters = useRef(applied)
  const searchInput = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<number | undefined>(undefined)
  const lastSubmittedQuery = useRef(filters.q)

  useLayoutEffect(() => {
    function restoreSearchFromHistory() {
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

  function applyFilters(changes: Partial<GalleryFilters>) {
    // Merge into the latest selection even before Next commits its server response.
    const next = { ...latestFilters.current, ...changes, page: 1 }
    latestFilters.current = next
    startTransition(async () => {
      setApplied(next)
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

  return <form action="/animals" method="get" className="gallery-filters" onSubmit={submitSearch}>
    <label className="search-text">
      <span>Search</span>
      <input ref={searchInput} name="q" type="search" placeholder="Name, breed, description" defaultValue={filters.q} maxLength={200} onChange={event => scheduleSearch(event.currentTarget.value.slice(0, 200))} />
    </label>
    <SpeciesPicker showLabel value={applied.species} onValueChange={species => applyFilters({ species })} />
    {selects.map(({ name, label, options }) => <FilterSelect
      key={name}
      label={label}
      name={name}
      options={options}
      value={applied[name]}
      onValueChange={value => applyFilters({ [name]: value })}
    />)}
    <fieldset className="compatibility-filters">
      <legend>Friendly with</legend>
      {compatibility.map(({ name, label }) => <label key={name}>
        <input type="checkbox" name={name} value="true" checked={applied[name]} onChange={event => applyFilters({ [name]: event.currentTarget.checked })} /> {label}
      </label>)}
    </fieldset>
    <div className="filter-actions">
      <noscript><button type="submit" className="button">Apply filters</button></noscript>
      <Link href="/animals" scroll={false} onNavigate={event => {
        event.preventDefault()
        window.clearTimeout(searchTimer.current)
        if (searchInput.current) searchInput.current.value = ''
        lastSubmittedQuery.current = ''
        applyFilters(emptyGalleryFilters)
      }}>Clear filters</Link>
    </div>
    <GalleryStatus pending={isPending} />
  </form>
}

function GalleryStatus({ pending }: { pending: boolean }) {
  return <div className="gallery-status" role="status">
    {pending && <>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/images/gallery-cat-static.png" />
        <img src="/images/gallery-cat.apng" alt="" width={64} height={40} />
      </picture>
      <span>Looking for friends…</span>
    </>}
  </div>
}
