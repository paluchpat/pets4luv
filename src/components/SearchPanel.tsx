'use client'

import Link from 'next/link'
import { type MouseEvent, useRef, useState } from 'react'
import { galleryResultsHeadingId } from '@/lib/gallery-filters'
import { Icon } from './Icons'
import { FilterSelect } from './FilterSelect'
import { SpeciesPicker } from './SpeciesPicker'
import { ageOptions, genderOptions } from './filter-options'

function isBackdropEvent(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false

  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
  return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom
}

export function SearchPanel() {
  const animalSearch = useRef<HTMLFormElement>(null)
  const chatDialog = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)
  const [canSend, setCanSend] = useState(false)

  function goToAnimalSearch() {
    chatDialog.current?.close()
    const form = animalSearch.current
    form?.querySelector<HTMLInputElement>('input[name="species"]:checked')?.focus({ preventScroll: true })
    form?.scrollIntoView({ block: 'center' })
  }

  const resourceLinks = <>You can also read about <Link href="/info/adoption">adoption</Link>, <Link href="/info/volunteering">volunteering</Link>, or get the <Link href="/applications">application forms</Link>.</>

  return <section className="search-panel" aria-labelledby="find-title">
    <div className="search-heading"><h2 id="find-title">Find your furry best friend</h2><Link className="text-link" href="/animals">View all animals <span aria-hidden="true">→</span></Link></div>
    <form action={`/animals#${galleryResultsHeadingId}`} className="home-filters" method="get" ref={animalSearch}>
      <SpeciesPicker showLabel />
      <FilterSelect label="Age" name="ageGroup" options={ageOptions} />
      <FilterSelect label="Gender" name="gender" options={genderOptions} />
      <button className="button matching-button" type="submit">Show matching pets <Icon kind="arrow" /></button>
    </form>
    <div className="or-divider"><span>OR tell us what you’re looking for</span></div>
    <section className="chat-composer" aria-labelledby="chat-title" id="ask-pets4luv">
      <h3 id="chat-title"><Icon kind="chat" />Ask Pets4Luv</h3>
      <div className="compose-row">
        <textarea
          id="companion-message"
          aria-label="Tell us about your ideal companion"
          placeholder="Tell us about your ideal companion"
          autoComplete="off"
          onChange={event => setCanSend(event.target.value.trim().length > 0)}
          rows={2}
        />
        <button
          className="button"
          type="button"
          aria-haspopup="dialog"
          disabled={!canSend}
          onClick={event => {
            event.currentTarget.focus({ preventScroll: true })
            startedOnBackdrop.current = false
            chatDialog.current?.showModal()
          }}
        >Send <span aria-hidden="true">▶</span></button>
      </div>
      <p className="chat-help">{resourceLinks}</p>
    </section>
    <dialog
      className="chat-dialog"
      ref={chatDialog}
      aria-labelledby="chat-dialog-title"
      aria-describedby="chat-dialog-description"
      onPointerDown={event => {
        startedOnBackdrop.current = event.isPrimary && event.button === 0 && isBackdropEvent(event)
      }}
      onPointerCancel={() => { startedOnBackdrop.current = false }}
      onClick={event => {
        const shouldClose = startedOnBackdrop.current && isBackdropEvent(event)
        startedOnBackdrop.current = false
        if (shouldClose) event.currentTarget.close()
      }}
    >
      <h2 id="chat-dialog-title">Ask Pets4Luv is still in development</h2>
      <p id="chat-dialog-description">In the meantime, use the animal search form to find adoptable cats and dogs.</p>
      <div className="chat-dialog-actions">
        <button className="button" type="button" onClick={goToAnimalSearch}>Use animal search</button>
        <button className="button secondary" type="button" onClick={() => chatDialog.current?.close()}>Close</button>
      </div>
      <p>{resourceLinks}</p>
    </dialog>
  </section>
}

export function ChatLauncher() {
  return <button className="button secondary chat-launcher" type="button" onClick={() => { document.getElementById('ask-pets4luv')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('companion-message')?.focus({ preventScroll: true }) }}><Icon kind="chat" />Ask Pets4Luv</button>
}
