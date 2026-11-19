'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

type Option = { value: string; label: string; shortLabel?: string; swatch?: string }
type Props = {
  name: string
  label: string
  options: readonly Option[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}

/** A progressively enhanced select: native without JavaScript, anchored listbox after hydration. */
export function FilterSelect({ name, label, options, defaultValue = '', value: controlledValue, onValueChange, className = '' }: Props) {
  const id = useId()
  const labelId = `${id}-label`
  const triggerId = `${id}-trigger`
  const listId = `${id}-options`
  const [enhanced, setEnhanced] = useState(false)
  const [localValue, setLocalValue] = useState(defaultValue)
  const value = controlledValue ?? localValue
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const anchor = `--filter-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => { setEnhanced(true) }, [])
  useEffect(() => { setLocalValue(defaultValue); setOpen(false) }, [defaultValue])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [open, activeIndex])

  function choose(index: number) {
    const next = options[index].value
    if (controlledValue === undefined) setLocalValue(next)
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
    if (next !== value) onValueChange?.(next)
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return }
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true }) }
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(activeIndex)
      else { setActiveIndex(selectedIndex); setOpen(true) }
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : !open ? selectedIndex : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
      setActiveIndex(next)
      setOpen(true)
    }
  }

  return <div ref={root} className={`filter-select ${className}`} style={{ '--filter-anchor': anchor } as CSSProperties} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <label id={labelId} className="filter-field-label" htmlFor={enhanced ? triggerId : `${id}-native`}>{label}</label>
    {enhanced ? <>
      <input type="hidden" name={name} value={value} />
      <button ref={trigger} type="button" id={triggerId} className="filter-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-labelledby={`${labelId} ${id}-value`} aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined} onKeyDown={onKeyDown} onClick={() => { setActiveIndex(selectedIndex); setOpen(previous => !previous) }}><span id={`${id}-value`}>{options[selectedIndex].shortLabel ?? options[selectedIndex].label}</span><svg viewBox="0 0 16 10" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m2 2 6 6 6-6" /></svg></button>
      {open && <div ref={list} id={listId} role="listbox" aria-labelledby={labelId} className="filter-select-options">
        {options.map((option, index) => <div
          key={option.value}
          id={`${id}-option-${index}`}
          role="option"
          aria-selected={option.value === value}
          data-option-index={index}
          data-highlighted={index === activeIndex || undefined}
          className="filter-select-option"
          onPointerDown={event => event.preventDefault()}
          onPointerMove={event => { if (event.pointerType === 'mouse') setActiveIndex(index) }}
          onClick={() => choose(index)}
        >
          <span className={option.swatch ? 'filter-option-label' : undefined}>
            {option.swatch && <span className="filter-option-swatch" aria-hidden="true" style={{ background: option.swatch }} />}
            {option.label}
          </span>
          <span className="filter-option-check" aria-hidden="true">{option.value === value ? '✓' : ''}</span>
        </div>)}
      </div>}
    </> : <select id={`${id}-native`} name={name} defaultValue={value} onChange={event => {
      if (controlledValue === undefined) setLocalValue(event.currentTarget.value)
      onValueChange?.(event.currentTarget.value)
    }}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
  </div>
}
