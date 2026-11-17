'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { AnimalPhotoDTO } from '@/lib/public-content'
import styles from './AnimalGallery.module.css'

const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'

export function AnimalGallery({ name, photos }: { name: string; photos: AnimalPhotoDTO[] }) {
  const [selected, setSelected] = useState(0)
  const viewport = useRef<HTMLDivElement>(null)
  const thumbnails = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(0)
  const id = useId()
  const active = Math.min(selected, Math.max(0, photos.length - 1))
  const multiple = photos.length > 1
  const photoSet = photos.map(photo => photo.url).join('\n')

  // A new profile/photo set starts with its main photo. Resizing keeps the current slide aligned.
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    setSelected(0)
    selectedRef.current = 0
    element.scrollTo({ left: 0, behavior: 'instant' })
    const observer = new ResizeObserver(() => {
      element.scrollTo({ left: selectedRef.current * element.clientWidth, behavior: 'instant' })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [photoSet])

  useEffect(() => {
    const strip = thumbnails.current
    const button = strip?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!strip || !button) return
    const bounds = strip.getBoundingClientRect()
    const thumb = button.getBoundingClientRect()
    // Scroll this strip horizontally without moving the page up or down.
    if (thumb.left < bounds.left) strip.scrollBy({ left: thumb.left - bounds.left - 2, behavior: scrollBehavior() })
    else if (thumb.right > bounds.right) strip.scrollBy({ left: thumb.right - bounds.right + 2, behavior: scrollBehavior() })
  }, [active])

  function show(index: number) {
    const element = viewport.current
    if (!element || !photos.length) return
    const next = (index + photos.length) % photos.length
    element.scrollTo({ left: next * element.clientWidth, behavior: scrollBehavior() })
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'ArrowLeft') show(active - 1)
    else if (event.key === 'ArrowRight') show(active + 1)
    else if (event.key === 'Home') show(0)
    else if (event.key === 'End') show(photos.length - 1)
    else return
    event.preventDefault()
  }

  return <section className={styles.gallery} aria-label={`Photos of ${name}`} aria-roledescription={multiple ? 'carousel' : undefined}>
    <div className={styles.main}>
      <div id={id} ref={viewport} className={styles.viewport} role="group" tabIndex={multiple ? 0 : undefined}
        aria-label={multiple ? 'Swipe to browse photos, or use the left and right arrow keys.' : undefined}
        onKeyDown={multiple ? onKeyDown : undefined}
        onScroll={event => {
          const element = event.currentTarget
          if (!element.clientWidth) return
          const index = Math.max(0, Math.min(photos.length - 1, Math.round(element.scrollLeft / element.clientWidth)))
          selectedRef.current = index
          setSelected(index)
        }}>
        {photos.length ? photos.map((photo, index) => <div key={photo.url} className={styles.slide}
          role="group" aria-roledescription="slide" aria-label={`Photo ${index + 1} of ${photos.length}`} aria-hidden={index !== active}>
          <img src={photo.url} alt={photo.alt || name} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
        </div>) : <div className={`${styles.slide} missing-photo`} role="img" aria-label={`Photo of ${name} not yet available`}>Photo coming soon</div>}
      </div>
      {multiple && <>
        <button type="button" className={`${styles.arrow} ${styles.previous}`} aria-label={`Previous photo of ${name}`} aria-controls={id} onClick={() => show(active - 1)}><ChevronLeft aria-hidden="true" /></button>
        <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={`Next photo of ${name}`} aria-controls={id} onClick={() => show(active + 1)}><ChevronRight aria-hidden="true" /></button>
      </>}
    </div>
    {multiple && <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">Photo {active + 1} of {photos.length} of {name}</p>
      <div ref={thumbnails} className={styles.thumbnails} role="group" aria-label={`Choose a photo of ${name}`}>
        {photos.map((photo, index) => <button key={photo.url} type="button" className={styles.thumbnail} aria-label={`View photo ${index + 1} of ${name}`} aria-pressed={index === active} aria-controls={id} onClick={() => show(index)}>
          <img src={photo.url} alt="" loading="lazy" draggable={false} />
        </button>)}
      </div>
    </>}
  </section>
}
