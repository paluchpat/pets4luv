'use client'

import { DragHandleIcon, DraggableSortable, DraggableSortableItem, useConfig, useDocumentDrawer, useField, useForm, useFormFields } from '@payloadcms/ui'
import { ImageOff, Pencil, Plus, Search, X } from 'lucide-react'
import type { ArrayFieldClientProps, Where } from 'payload'
import { stringify } from 'qs-esm'
import { useEffect, useId, useRef, useState } from 'react'
import { featuredAnimalEligibility, featuredAnimalLimit } from '../../lib/featured-animals'
import type { Animal } from '../../payload-types'

type FeaturedAnimal = Pick<Animal, 'id' | 'name' | 'photos' | 'status' | '_status'>
type AnimalPage = { docs: FeaturedAnimal[]; hasNextPage: boolean; hasPrevPage: boolean }
const pageSize = 10
const searchDelay = 300

function validateCount(value: unknown) {
  const count = Array.isArray(value) ? value.length : typeof value === 'number' ? value : 0
  return count <= featuredAnimalLimit || 'Choose up to three animals.'
}

function animalId(value: unknown) {
  const id = typeof value === 'object' && value && 'id' in value ? value.id : value
  return typeof id === 'number' && Number.isSafeInteger(id) ? id : null
}

function animalQuery(api: string, where: Where, limit: number, page = 1) {
  return api + '/animals?' + stringify({
    where, limit, page, depth: 2, draft: false, sort: 'name,id',
    select: { name: true, photos: true, status: true, _status: true },
    // Payload builds the file URL from the upload metadata.
    populate: { media: { url: true, filename: true, prefix: true } },
  })
}

function useAnimalPage(url: string, revision = 0) {
  const [result, setResult] = useState<{ url: string; page: AnimalPage | null }>()
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    async function loadPage() {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('Unable to load animals')
        const page = await response.json() as AnimalPage
        if (!controller.signal.aborted) setResult({ url, page })
      } catch {
        if (!controller.signal.aborted) setResult({ url, page: null })
      }
    }
    void loadPage()
    return () => controller.abort()
  }, [url, revision])

  return { page: result?.url === url ? result.page : undefined, loading: Boolean(url) && result?.url !== url }
}

function FeaturedPhoto({ animal }: { animal?: FeaturedAnimal }) {
  const photo = animal?.photos?.[0]?.photo
  const url = photo && typeof photo === 'object' ? photo.url : undefined
  return <span className="cms-animal-card-photo cms-featured-photo">
    {url ? <img className="cms-animal-card-image" src={url} alt="" /> : <ImageOff size={21} aria-hidden="true" />}
  </span>
}

function EditFeaturedAnimal({ animal, disabled, onUpdate }: {
  animal: FeaturedAnimal
  disabled: boolean
  onUpdate: () => void
}) {
  const [Drawer, Toggler, { closeDrawer }] = useDocumentDrawer({ collectionSlug: 'animals', id: animal.id })

  function finish() {
    closeDrawer()
    onUpdate()
  }

  return <>
    <Toggler className="cms-button" aria-label={`Edit details for ${animal.name}`} disabled={disabled}>
      <Pencil aria-hidden="true" />Edit details
    </Toggler>
    <Drawer onSave={finish} onDelete={finish} />
  </>
}

function AnimalPicker({ api, selected, disabled, onAdd, onClose }: {
  api: string
  selected: number[]
  disabled: boolean
  onAdd: (id: number) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [{ query, page }, setRequest] = useState({ query: '', page: 1 })
  const searchInput = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const searchValue = search.trim()
  const searchPending = searchValue !== query
  const where: Where = { and: [
    featuredAnimalEligibility,
    ...(selected.length ? [{ id: { not_in: selected } }] : []),
    ...(query ? [{ name: { contains: query } }] : []),
  ] }
  const { page: result, loading } = useAnimalPage(animalQuery(api, where, pageSize, page))

  useEffect(() => { searchInput.current?.focus() }, [])
  useEffect(() => {
    if (!searchPending) return
    const timer = window.setTimeout(() => setRequest({ query: searchValue, page: 1 }), searchDelay)
    return () => window.clearTimeout(timer)
  }, [searchPending, searchValue])

  return <section className="cms-featured-picker" aria-labelledby={titleId} aria-busy={loading}>
    <div className="cms-featured-toolbar">
      <h3 id={titleId}>Choose an animal</h3>
      <button type="button" className="cms-button" onClick={onClose}>Cancel</button>
    </div>
    <label className="cms-gallery-search">
      <Search aria-hidden="true" />
      <span className="cms-sr-only">Search available animals</span>
      <input ref={searchInput} type="search" placeholder="Search by name" value={search} maxLength={100}
        onChange={event => setSearch(event.target.value)} />
    </label>
    {loading && <p className="cms-featured-note" role="status">Searching animals…</p>}
    {result === null && <p className="cms-featured-note" role="alert">Could not load the available animals. Reopen the picker to try again.</p>}
    {result && !result.docs.length && <p className="cms-featured-note" role="status">No available animals match your search.</p>}
    {!!result?.docs.length && <ul className="cms-featured-options">
      {result.docs.map(animal => <li key={animal.id}>
        <button type="button" className="cms-button cms-featured-option" aria-label={'Add ' + animal.name}
          disabled={disabled} onClick={() => onAdd(animal.id)}>
          <FeaturedPhoto animal={animal} /><span>{animal.name}</span><Plus aria-hidden="true" />
        </button>
      </li>)}
    </ul>}
    {result && (result.hasPrevPage || result.hasNextPage) && <div className="cms-featured-actions">
      <button type="button" className="cms-button" disabled={disabled || searchPending || !result.hasPrevPage}
        onClick={() => setRequest({ query, page: page - 1 })}>Previous</button>
      <button type="button" className="cms-button" disabled={disabled || searchPending || !result.hasNextPage}
        onClick={() => setRequest({ query, page: page + 1 })}>Next</button>
    </div>}
  </section>
}

export function FeaturedAnimalsField({ field, path: initialPath, readOnly, schemaPath }: ArrayFieldClientProps) {
  const { config: { routes: { api } } } = useConfig()
  const { addFieldRow, getDataByPath, moveFieldRow, removeFieldRow } = useForm()
  const { path, rows = [], disabled, showError, errorMessage } = useField<number>({
    hasRows: true, potentiallyStalePath: initialPath,
    validate: validateCount,
  })
  const keys = useFormFields(([fields]) => JSON.stringify((fields[path]?.rows || []).map((_, index) =>
    animalId(fields[path + '.' + index + '.animal']?.value))))
  const ordered = JSON.parse(keys) as Array<number | null>
  const selected = [...new Set(ordered.flatMap(id => id === null ? [] : [id]))].sort((a, b) => a - b)
  const [previewRevision, setPreviewRevision] = useState(0)
  const previews = useAnimalPage(selected.length ? animalQuery(api, { id: { in: selected } }, selected.length) : '', previewRevision)
  const byId = new Map(previews.page?.docs.map(animal => [animal.id, animal]))
  const lead = ordered.slice(0, featuredAnimalLimit).find(id => {
    const animal = id === null ? undefined : byId.get(id)
    return animal?.status === 'available' && animal._status === 'published'
  })
  const canEdit = !readOnly && !field.admin?.readOnly
  const locked = !canEdit || disabled
  const canSort = !locked && rows.length > 1
  const atLimit = rows.length >= featuredAnimalLimit
  const [picking, setPicking] = useState(false)
  const pickerOpen = picking && !atLimit && canEdit
  const addButton = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const headingId = useId()

  function refreshPreviews() {
    setPreviewRevision(revision => revision + 1)
  }

  function closePicker() {
    setPicking(false)
    window.requestAnimationFrame(() => {
      if (addButton.current && !addButton.current.disabled) addButton.current.focus()
      else list.current?.lastElementChild?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    })
  }

  function addAnimal(id: number) {
    const current = getDataByPath(path) as { animal?: unknown }[] | undefined
    if (locked || atLimit || (current?.length ?? 0) >= featuredAnimalLimit || current?.some(row => animalId(row.animal) === id)) return
    addFieldRow({
      path, schemaPath: schemaPath || field.name,
      subFieldState: { animal: { value: id, initialValue: null, valid: true } },
    })
    closePicker()
  }

  function reorderAnimals({ moveFromIndex, moveToIndex }: { moveFromIndex: number; moveToIndex: number }) {
    if (!canSort || moveFromIndex < 0 || moveToIndex < 0 || moveFromIndex === moveToIndex) return
    moveFieldRow({ path, moveFromIndex, moveToIndex })
  }

  return <section className="field-type cms-featured-editor" aria-labelledby={headingId}>
    <h3 id={headingId}>Featured animals</h3>
    <p className="cms-featured-note">The first available animal gets the large photo on the homepage.{canSort && ' Drag the handles to reorder.'}</p>
    <div className="cms-featured-panel">
      {rows.length ? <DraggableSortable ids={rows.map(row => row.id)} onDragEnd={reorderAnimals}>
        <ol className="cms-featured-list" ref={list}>
          {rows.map((row, index) => {
            const id = ordered[index]
            const animal = id == null ? undefined : byId.get(id)
            const name = animal?.name || (previews.loading ? 'Loading animal…' : 'Unavailable selection')
            const hidden = !previews.loading && previews.page !== null && (index >= featuredAnimalLimit || !animal || animal.status !== 'available' || animal._status !== 'published')
            return <DraggableSortableItem key={row.id} id={row.id} disabled={!canSort}>
              {({ attributes, listeners, isDragging, setNodeRef, transform, transition }) => <li className="cms-featured-row"
                ref={setNodeRef} style={{ transform, transition }} data-dragging={isDragging || undefined}>
                <div className="cms-featured-animal">
                  {canSort && <button type="button" className="cms-featured-drag-handle" {...attributes} {...listeners}
                    aria-label={'Reorder ' + name} title="Drag to reorder">
                    <DragHandleIcon />
                  </button>}
                  <FeaturedPhoto animal={animal} />
                  <div className="cms-featured-label">
                    <strong>{name}</strong>
                    {animal && id === lead && index === ordered.indexOf(id) && <span className="cms-featured-lead">Lead on homepage</span>}
                    {hidden && <span>Hidden on homepage</span>}
                  </div>
                </div>
                {canEdit && <div className="cms-featured-row-actions">
                  {animal && <EditFeaturedAnimal animal={animal} disabled={locked} onUpdate={refreshPreviews} />}
                  <button type="button" className="cms-button cms-featured-icon" aria-label={'Remove ' + name} title="Remove from homepage"
                    disabled={locked} onClick={() => removeFieldRow({ path, rowIndex: index })}><X aria-hidden="true" /></button>
                </div>}
              </li>}
            </DraggableSortableItem>
          })}
        </ol>
      </DraggableSortable> : <p className="cms-featured-note">Choose up to three available animals.</p>}
      {previews.page === null && <p className="cms-featured-note" role="alert">Could not load the selected animal previews.</p>}
      {rows.length > featuredAnimalLimit && <p className="cms-featured-note" role="alert">Remove extra animals to keep three or fewer.</p>}
      {showError && errorMessage && <p className="cms-featured-note" role="alert">{errorMessage}</p>}
      <div className="cms-featured-add-controls">
        {canEdit && !pickerOpen && <button type="button" ref={addButton} className="cms-button cms-button-primary cms-featured-add"
          disabled={locked || atLimit} onClick={() => setPicking(true)}>
          <Plus aria-hidden="true" />Add animal
        </button>}
        <span className="cms-featured-count" role="status">{rows.length} of {featuredAnimalLimit} selected</span>
      </div>
      {pickerOpen && <AnimalPicker api={api} selected={selected} disabled={locked} onAdd={addAnimal} onClose={closePicker} />}
    </div>
  </section>
}
