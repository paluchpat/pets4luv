'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { AnimalPhotoDTO } from '@/lib/public-content'
import styles from './AnimalGallery.module.css'

const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'

export function AnimalGallery({ name, photos }: { name: string; photos: AnimalPhotoDTO[] }) {
  const [selected, setSelected] = useState(0)
  const viewport = useRef<HTMLDivElement>(null)
  const thumbnails = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(0)
  const pointerDrag = useRef<AbortController | null>(null)
  const settleFrame = useRef(0)
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
    return () => {
      observer.disconnect()
      pointerDrag.current?.abort()
      pointerDrag.current = null
      stopSettling(element)
      delete element.dataset.dragging
    }
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
    if (settleFrame.current) {
      settleDrag(element, next)
      return
    }
    element.scrollTo({ left: next * element.clientWidth, behavior: scrollBehavior() })
  }

  function stopSettling(element: HTMLDivElement) {
    cancelAnimationFrame(settleFrame.current)
    settleFrame.current = 0
    delete element.dataset.settling
  }

  function settleDrag(element: HTMLDivElement, index: number) {
    const origin = element.scrollLeft
    const distance = element.children[index].getBoundingClientRect().left - element.getBoundingClientRect().left
    // Keep snap disabled until the photo is aligned, so release starts at the pointer's position.
    element.dataset.settling = 'true'
    delete element.dataset.dragging
    cancelAnimationFrame(settleFrame.current)

    if (scrollBehavior() === 'instant' || Math.abs(distance) <= 1) {
      element.scrollLeft = origin + distance
      stopSettling(element)
      return
    }

    const start = performance.now()
    const duration = 200 + Math.min(1, Math.abs(distance) / element.clientWidth) * 180
    // Both pointer types use the same ease-out and come to rest exactly at the snap point.
    function animate(now: number) {
      const progress = Math.min(1, (now - start) / duration)
      const ease = 1 - (1 - progress) ** 3
      element.scrollLeft = origin + distance * ease
      if (progress === 1) stopSettling(element)
      else settleFrame.current = requestAnimationFrame(animate)
    }
    settleFrame.current = requestAnimationFrame(animate)
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return
    const element = event.currentTarget
    const { pointerId, clientX: startX, clientY: startY } = event
    const slideWidth = element.clientWidth
    let startLeft = element.scrollLeft
    let startIndex = active
    let moved = false
    pointerDrag.current?.abort()
    const controller = new AbortController()
    pointerDrag.current = controller

    function move(pointer: PointerEvent) {
      if (pointer.pointerId !== pointerId) return
      const distance = pointer.clientX - startX
      if (!moved) {
        if (Math.abs(distance) < 6 || Math.abs(distance) <= Math.abs(pointer.clientY - startY)) return
        moved = true
        element.dataset.dragging = 'true'
        if (settleFrame.current) {
          startLeft = element.scrollLeft
          startIndex = selectedRef.current
          stopSettling(element)
        }
      }
      element.scrollLeft = startLeft - Math.max(-slideWidth, Math.min(slideWidth, distance))
    }

    function finish(pointer?: PointerEvent) {
      if (pointer && pointer.pointerId !== pointerId) return
      controller.abort()
      pointerDrag.current = null
      if (!moved) return
      const distance = pointer?.type === 'pointerup' ? startX - pointer.clientX : 0
      const threshold = Math.min(56, slideWidth / 5)
      const step = Math.abs(distance) >= threshold ? Math.sign(distance) : 0
      settleDrag(element, Math.max(0, Math.min(photos.length - 1, startIndex + step)))
    }

    // Keep tracking until release, including when the pointer leaves the photo.
    const options = { signal: controller.signal }
    window.addEventListener('pointermove', move, options)
    window.addEventListener('pointerup', finish, options)
    window.addEventListener('pointercancel', finish, options)
    window.addEventListener('blur', () => finish(), options)
    element.setPointerCapture(pointerId)
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
      <div id={id} ref={viewport} className={multiple ? `${styles.viewport} ${styles.draggable}` : styles.viewport} role="group" tabIndex={multiple ? 0 : undefined}
        aria-label={multiple ? 'Drag or swipe to browse photos, or use the left and right arrow keys.' : undefined}
        onKeyDown={multiple ? onKeyDown : undefined}
        onPointerDown={multiple ? startDrag : undefined}
        onScroll={event => {
          const element = event.currentTarget
          if (!element.clientWidth) return
          const index = Math.max(0, Math.min(photos.length - 1, Math.round(element.scrollLeft / element.clientWidth)))
          selectedRef.current = index
          setSelected(index)
        }}>
        {photos.length ? photos.map((photo, index) => <div key={photo.url} className={`${styles.slide} portrait-photo`}
          role="group" aria-roledescription="slide" aria-label={`Photo ${index + 1} of ${photos.length}`} aria-hidden={index !== active}>
          <img className="portrait-photo-backdrop" src={photo.url} alt="" aria-hidden="true" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
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
