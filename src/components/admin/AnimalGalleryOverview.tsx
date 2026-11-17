'use client'

import Link from 'next/link'
import { ArrowRight, PawPrint } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { AdminAnimalCard } from '../../lib/admin-animal-gallery'
import { AddAnimal, AnimalProfileCard } from './AnimalGalleryListClient'

export function AnimalGalleryOverview({ cards, canCreate, adminRoute }: { cards: AdminAnimalCard[]; canCreate: boolean; adminRoute: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  function saved(status?: string) { setMessage(status === 'published' ? 'Profile published.' : 'Draft saved.'); router.refresh() }
  return <section className="cms-gallery-overview" aria-labelledby="dashboard-animals-heading">
    <div className="cms-gallery-heading"><div><p className="cms-eyebrow">Animals</p><h2 id="dashboard-animals-heading">Your animals</h2></div>{canCreate && <AddAnimal onSaved={saved} />}</div>
    {message && <p className="cms-success" role="status">{message}</p>}
    <div className="cms-animal-grid">{cards.map(card => <AnimalProfileCard key={card.id} card={card} onSaved={saved} onDeleted={() => { setMessage('Profile removed.'); router.refresh() }} />)}</div>
    {!cards.length && <div className="cms-gallery-empty"><PawPrint aria-hidden="true" /><p>Add your first animal profile to get started.</p></div>}
    <Link className="cms-gallery-view-all" href={`${adminRoute}/collections/animals`}>See all animals<ArrowRight aria-hidden="true" /></Link>
  </section>
}
