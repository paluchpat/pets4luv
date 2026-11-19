'use client'

import { Gutter, useDocumentDrawer, useListDrawerContext, useListQuery, useStepNav } from '@payloadcms/ui'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ImagePlus, Info, Pencil, Plus, Search, SlidersHorizontal, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import type { Where } from 'payload'
import type { AdminAnimalCard } from '../../lib/admin-animal-gallery'
import { adminAnimalFilters, adminAnimalFilterValue, updateAdminAnimalFilter } from '../../lib/admin-animal-filters'
import { Icon } from '../Icons'

const sortOptions = [
  { value: '-updatedAt', label: 'Recently updated' },
  { value: '-createdAt', label: 'Newest addition' },
  { value: 'createdAt', label: 'Oldest addition' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-name', label: 'Name (Z–A)' },
]

export function AnimalGalleryListClient({ cards, canCreate, nativeList }: { cards: AdminAnimalCard[]; canCreate: boolean; nativeList: ReactNode }) {
  const { isInDrawer } = useListDrawerContext()
  return isInDrawer ? nativeList : <AnimalGalleryWorkspace cards={cards} canCreate={canCreate} />
}

function AnimalGalleryWorkspace({ cards, canCreate }: { cards: AdminAnimalCard[]; canCreate: boolean }) {
  const router = useRouter()
  const { data, query, refineListData } = useListQuery()
  const { setStepNav } = useStepNav()
  const [search, setSearch] = useState(String(query.search || ''))
  const searchIsLocal = useRef(false)
  const [message, setMessage] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const gallery = useRef<HTMLDivElement>(null)
  const previousPage = useRef(data?.page)
  const where = query.where as Where | undefined
  const sort = query.sort || sortOptions[0].value
  const selected = adminAnimalFilterValue(where, 'species') || 'all'
  const activeFilters = adminAnimalFilters.filter(filter => adminAnimalFilterValue(where, filter.field, filter.operator)).length
  const hasCriteria = Boolean(search.trim() || Object.keys(where || {}).length)
  useEffect(() => { setStepNav([{ label: 'Animals' }]) }, [setStepNav])
  // Restore initial list preferences, but never replace newer typing with an older response.
  useEffect(() => {
    if (!searchIsLocal.current) setSearch(String(query.search || ''))
  }, [query.search])
  useEffect(() => {
    function restoreSearchFromHistory() {
      searchIsLocal.current = true
      setSearch(new URLSearchParams(window.location.search).get('search') || '')
    }
    window.addEventListener('popstate', restoreSearchFromHistory)
    return () => window.removeEventListener('popstate', restoreSearchFromHistory)
  }, [])
  useEffect(() => {
    if (search.trim() === String(query.search || '')) return
    const timer = window.setTimeout(() => {
      startTransition(() => { void refineListData({ search: search.trim() || undefined, page: 1 }) })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, query.search, refineListData])
  useEffect(() => {
    if (data?.page !== previousPage.current) gallery.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    previousPage.current = data?.page
  }, [data?.page])

  function saved(status?: string) {
    setMessage(status === 'published' ? 'Profile published. Your website is up to date.' : 'Draft saved. Publish when you’re ready.')
    router.refresh()
  }
  function filter(field: string, value: string, operator: 'equals' | 'contains' = 'equals') {
    startTransition(() => { void refineListData({ where: updateAdminAnimalFilter(where, field, value, operator), search: search.trim() || undefined, page: 1 }) })
  }
  function changeSearch(value: string) {
    searchIsLocal.current = true
    setSearch(value)
  }
  function clearFilters() {
    changeSearch('')
    startTransition(() => { void refineListData({ where: {}, search: undefined, page: 1 }) })
  }
  const total = data?.totalDocs || 0
  const start = total ? data?.pagingCounter || 1 : 0
  const end = Math.min(total, start + cards.length - 1)
  return <div ref={gallery}><Gutter className="cms-animal-gallery">
    <div className="cms-gallery-heading">
      <h1>Your animals</h1>
      {canCreate && <AddAnimal onSaved={saved} />}
    </div>
    {message && <div className="cms-success" role="status"><CheckCircle2 aria-hidden="true" />{message}<button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}>×</button></div>}
    <div className="cms-gallery-toolbar-wrap">
      <div className="cms-gallery-toolbar">
        <label className="cms-gallery-search"><Search aria-hidden="true" /><span className="cms-sr-only">Search animal profiles</span>
          <input type="search" placeholder="Search names, breeds, notes, intake IDs…" aria-describedby="cms-animal-search-help" value={search} maxLength={100} onChange={event => changeSearch(event.target.value)} />
        </label>
        <p className="cms-gallery-search-help" id="cms-animal-search-help">Search names, notes, intake IDs, or combine details like “small black female cat”. Use quotes to search a name or phrase literally.</p>
        <div className="cms-species-filters" role="group" aria-label="Pet type">
          {[{ value: 'all', label: 'All animals', icon: 'paw' }, { value: 'cat', label: 'Cats', icon: 'cat' }, { value: 'dog', label: 'Dogs', icon: 'dog' }].map(item => <button key={item.value} type="button" aria-pressed={selected === item.value} onClick={() => filter('species', item.value === 'all' ? '' : item.value)}><Icon kind={item.icon as 'paw' | 'cat' | 'dog'} />{item.label}</button>)}
        </div>
      </div>
      <div className="cms-gallery-filter-bar">
        <button type="button" className="cms-button cms-gallery-filter-toggle" aria-expanded={filtersOpen}
          aria-controls="cms-animal-filters" onClick={() => setFiltersOpen(open => !open)}>
          <SlidersHorizontal aria-hidden="true" />Additional filters{activeFilters > 0 && <span className="cms-filter-count">{activeFilters}<span className="cms-sr-only"> active</span></span>}<ChevronDown className="cms-filters-chevron" aria-hidden="true" />
        </button>
        {hasCriteria && <button type="button" className="cms-clear-filters" onClick={clearFilters}>Clear search and filters</button>}
        <label className="cms-gallery-sort">
          <span className="cms-gallery-sort-label">Sort by</span>
          <span className="cms-filter-control"><select value={sort} onChange={event => {
            const nextSort = event.target.value
            startTransition(() => { void refineListData({ sort: nextSort, search: search.trim() || undefined, page: 1 }) })
          }}>
            {!sortOptions.some(option => option.value === sort) && <option value={sort}>Saved sort</option>}
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select><ChevronDown aria-hidden="true" /></span>
        </label>
      </div>
      <div className="cms-gallery-filter-grid" id="cms-animal-filters" hidden={!filtersOpen}>
        {adminAnimalFilters.map(item => <label className="cms-gallery-filter" key={item.field}>
          <span>{item.label}</span>
          <span className="cms-filter-control"><select value={adminAnimalFilterValue(where, item.field, item.operator)} onChange={event => filter(item.field, event.target.value, item.operator)}>
            <option value="">{item.empty}</option>
            {item.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select><ChevronDown aria-hidden="true" /></span>
        </label>)}
      </div>
    </div>
    <div className="cms-gallery-results" aria-busy={pending}>
      {pending && <p className="cms-loading" role="status">Searching animals...</p>}
      <div className="cms-animal-grid">
        {cards.map(card => <AnimalProfileCard key={card.id} card={card} onSaved={saved} onDeleted={() => { setMessage('Profile removed from the catalog.'); router.refresh() }} />)}
      </div>
      {!cards.length && <div className="cms-gallery-empty"><ImagePlus aria-hidden="true" /><h2>{hasCriteria ? 'No animals match your search.' : 'Ready for your first animal?'}</h2><p>{hasCriteria ? 'Try different search terms or clear your filters.' : 'Add a profile, upload their photos, and save a draft to get started.'}</p>{hasCriteria && <button type="button" className="cms-button" onClick={clearFilters}>Clear search and filters</button>}</div>}
    </div>
    <div className="cms-gallery-pagination">
      <p aria-live="polite">{start}–{Math.max(0, end)} of {total} {total === 1 ? 'animal' : 'animals'}</p>
      <div><button type="button" className="cms-button" disabled={!data?.hasPrevPage || pending} onClick={() => startTransition(() => { void refineListData({ page: data?.prevPage || 1 }) })}><ArrowLeft aria-hidden="true" />Previous</button>
      <button type="button" className="cms-button" disabled={!data?.hasNextPage || pending} onClick={() => startTransition(() => { void refineListData({ page: data?.nextPage || 1 }) })}>Next<ArrowRight aria-hidden="true" /></button></div>
    </div>
    <p className="cms-gallery-note"><Info aria-hidden="true" />Only published, available animals appear in the website’s adoption gallery.</p>
  </Gutter></div>
}

export function AddAnimal({ onSaved }: { onSaved: (status?: string) => void }) {
  const [Drawer, Toggler, { closeDrawer }] = useDocumentDrawer({ collectionSlug: 'animals' })
  return <><Toggler className="cms-button cms-button-primary"><Plus aria-hidden="true" />Add an animal</Toggler><Drawer redirectAfterCreate={false} onSave={({ doc }) => { closeDrawer(); onSaved('_status' in doc ? String(doc._status) : undefined) }} /></>
}

export function AnimalProfileCard({ card, onSaved, onDeleted, compact = false }: { card: AdminAnimalCard; onSaved: (status?: string) => void; onDeleted: () => void; compact?: boolean }) {
  const [Drawer, Toggler, { closeDrawer }] = useDocumentDrawer({ collectionSlug: 'animals', id: card.id })
  const status = card.status === 'on-hold' ? 'Pending' : card.status === 'adopted' ? 'Adopted' : card.status === 'available' ? 'Available' : 'Status not set'
  const publication = card.publication === 'changed' ? 'Draft changes' : card.publication === 'draft' ? 'Draft' : 'Published'
  const featuredLabel = card.featured ? <span className="cms-featured-badge"><Star aria-hidden="true" />Featured</span> : null
  return <><Toggler className="cms-animal-card" aria-label={`Edit ${card.name}`}>
    <div className="cms-animal-card-photo">
      {card.photo ? <><img className="cms-animal-card-backdrop" src={card.photo.url} alt="" aria-hidden="true" loading="lazy" /><img className="cms-animal-card-image" src={card.photo.url} alt={card.photo.alt || card.name} loading="lazy" /></> : <span className="cms-photo-placeholder"><ImagePlus aria-hidden="true" />Add a photo</span>}
      {!compact && featuredLabel}
      <span className="cms-card-edit"><Pencil aria-hidden="true" /><span className="cms-sr-only">Edit profile</span></span>
    </div>
    <div className="cms-animal-card-body"><h2>{card.name}</h2>{compact && featuredLabel}<p className="cms-animal-card-meta">{card.age} · {card.gender} · {card.photos} {card.photos === 1 ? 'photo' : 'photos'}</p>
      <div className="cms-card-status"><span className="cms-status-badge" data-status={card.status || 'unknown'}><CheckCircle2 aria-hidden="true" />{status}</span><span className="cms-publication" data-publication={card.publication}>{publication}</span></div>
      {card.updated && <p className="cms-updated">Updated {card.updated}</p>}
    </div>
  </Toggler><Drawer onSave={({ doc }) => { closeDrawer(); onSaved('_status' in doc ? String(doc._status) : undefined) }} onDelete={() => { closeDrawer(); onDeleted() }} /></>
}
