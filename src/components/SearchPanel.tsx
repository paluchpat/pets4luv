'use client'

import Link from 'next/link'
import { Icon } from './Icons'
import { FilterSelect } from './FilterSelect'
import { SpeciesPicker } from './SpeciesPicker'
import { ageOptions, genderOptions } from './filter-options'

export function SearchPanel() {
  return <section className="search-panel" aria-labelledby="find-title">
    <div className="search-heading"><h2 id="find-title">Find your furry best friend</h2><Link className="text-link" href="/animals">View all animals <span aria-hidden="true">→</span></Link></div>
    <form action="/animals" className="home-filters" method="get">
      <SpeciesPicker showLabel />
      <FilterSelect label="Age" name="ageGroup" options={ageOptions} />
      <FilterSelect label="Gender" name="gender" options={genderOptions} />
      <button className="button matching-button" type="submit">Show matching pets <Icon kind="arrow" /></button>
    </form>
    <div className="or-divider"><span>OR tell us what you’re looking for</span></div>
    <section className="chat-composer" aria-labelledby="chat-title" id="ask-pets4luv">
      <h3 id="chat-title"><Icon kind="chat" />Ask Pets4Luv</h3>
      <div className="compose-row"><textarea id="companion-message" aria-label="Tell us about your ideal companion" placeholder="Tell us about your ideal companion" aria-describedby="chat-status chat-help" readOnly rows={2} /><button className="button" disabled aria-label="Send unavailable">Send <span aria-hidden="true">▶</span></button></div>
      <p id="chat-status" className="chat-status">AI chat is unavailable in this local demo. Use the filters above to find a match.</p>
      <p id="chat-help" className="chat-help">You can also read about <Link href="/info/adoption">adoption</Link>, <Link href="/info/care">pet care</Link>, or <Link href="/info/volunteering">volunteering</Link>.</p>
    </section>
  </section>
}

export function ChatLauncher() {
  return <button className="button chat-launcher" type="button" onClick={() => { document.getElementById('ask-pets4luv')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('companion-message')?.focus({ preventScroll: true }) }}><Icon kind="chat" />Ask Pets4Luv</button>
}
