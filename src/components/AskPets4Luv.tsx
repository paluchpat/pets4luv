'use client'

import { type MouseEvent, type ReactNode, useRef, useState } from 'react'
import { Icon } from './Icons'

function isBackdropEvent(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false

  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
  return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom
}

export function AskPets4Luv({ resourceLinks }: { resourceLinks: ReactNode }) {
  const chatDialog = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)
  const [canSend, setCanSend] = useState(false)

  function goToAnimalSearch() {
    chatDialog.current?.close()
    const form = document.getElementById('home-animal-search')
    form?.querySelector<HTMLInputElement>('input[name="species"]:checked')?.focus({ preventScroll: true })
    form?.scrollIntoView({ block: 'center' })
  }

  return <>
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
        >Send <Icon kind="send" /></button>
      </div>
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
    <button
      className="button secondary chat-launcher"
      type="button"
      onClick={() => {
        document.getElementById('ask-pets4luv')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        document.getElementById('companion-message')?.focus({ preventScroll: true })
      }}
    >
      <Icon kind="chat" />Ask Pets4Luv
    </button>
  </>
}
