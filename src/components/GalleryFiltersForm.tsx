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
  { name: 'size', label: 'Size', options: sizeOptions },
  { name: 'sex', label: 'Sex', options: sexOptions },
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
  const lastSubmittedQuery = useRef(filters.q)

  useLayoutEffect(() => {
    latestFilters.current = applied
    // Filter changes leave the input's draft alone. A different URL query replaces it.
    if (applied.q !== lastSubmittedQuery.current && searchInput.current) {
      searchInput.current.value = applied.q
      lastSubmittedQuery.current = applied.q
    }
  }, [applied])

  function applyFilters(changes: Partial<GalleryFilters>) {
    // Merge into the latest selection even before Next commits its server response.
    const next = { ...latestFilters.current, ...changes, page: 1 }
    latestFilters.current = next
    startTransition(() => {
      setApplied(next)
      router.push(galleryHref(next), { scroll: false })
    })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = (searchInput.current?.value ?? '').slice(0, 200)
    lastSubmittedQuery.current = q
    applyFilters({ q })
  }

  return <form action="/animals" method="get" className="gallery-filters" onSubmit={submitSearch}>
    <label className="search-text">
      <span>Search</span>
      <input ref={searchInput} name="q" type="search" placeholder="Name, breed, description" defaultValue={filters.q} maxLength={200} />
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
      <button type="submit" className="button">Show matching pets <span aria-hidden="true">→</span></button>
      <Link href="/animals" scroll={false} onNavigate={event => {
        event.preventDefault()
        if (searchInput.current) searchInput.current.value = ''
        lastSubmittedQuery.current = ''
        applyFilters(emptyGalleryFilters)
      }}>Clear filters</Link>
    </div>
    <GalleryLoading pending={isPending} />
  </form>
}

function GalleryLoading({ pending }: { pending: boolean }) {
  return <div className="gallery-loading" role="status">
    {pending && <>
      <svg viewBox="0 0 56 34" aria-hidden="true" focusable="false">
        <g stroke="var(--burgundy)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M13 25C6 31 1 25 4 20" />
          <path d="M11 27c0-7 5-12 13-12l3-7 4 5 6-3v6c3 2 3 6 0 8-2 2-5 2-8 2l-4 3H14c-2 0-3-1-3-2Z" fill="#f8e1ce" />
          <path d="M30 18h.1m5 1h.1" strokeWidth="2.3" />
          <path d="m38 22 1-.5m-20 6c1-2 2-3 4-3" />
          <path className="gallery-loading-paw" d="M25 24c4 1 7 0 11-1" strokeWidth="2.5" />
        </g>
        <g className="gallery-loading-yarn">
          <circle cx="45" cy="25" r="5.5" fill="var(--burgundy)" />
          <path d="M41.5 22.5 45.5 29m-2-8 5 7m-6.5-2.5 5.5-3m-3.4 5.4 4.6-2.8" fill="none" stroke="#fff6ed" strokeWidth=".8" strokeLinecap="round" />
        </g>
      </svg>
      <span>Finding matches…</span>
    </>}
  </div>
}
