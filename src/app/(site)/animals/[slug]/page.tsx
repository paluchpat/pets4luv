import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAnimal } from '@/lib/content'
import { AnimalGallery } from '@/components/AnimalGallery'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const animal = await getAnimal((await params).slug)
  return { title: animal ? animal.name : 'Animal not found' }
}

export default async function AnimalPage({ params }: Props) {
  const animal = await getAnimal((await params).slug)
  if (!animal) notFound()
  const assessments = [{ label: 'Dogs', value: animal.compatibility.dogs }, { label: 'Cats', value: animal.compatibility.cats }, { label: 'Children', value: animal.compatibility.children }]
  const assessmentLabels: Record<string, string> = { yes: 'Assessed as compatible', no: 'Not a suitable match', unknown: 'Not yet assessed', conditional: 'May be suitable with conditions' }
  return <main id="main" className="page-shell"><Link className="back-link" href="/animals">← All available animals</Link><article className="animal-profile"><div className="profile-photo"><AnimalGallery name={animal.name} photos={animal.photos} /></div><div className="profile-intro"><p className="section-label">{animal.status === 'available' ? 'Looking for a loving home' : animal.status === 'on-hold' ? 'Adoption pending' : 'Adopted'}</p><h1>{animal.name}</h1>{animal.summary && <p className="profile-summary">{animal.summary}</p>}<dl className="animal-facts"><div><dt>Pet type</dt><dd>{animal.species === 'cat' ? 'Cat' : 'Dog'}</dd></div><div><dt>Age</dt><dd>{animal.ageLabel || animal.ageGroup}</dd></div><div><dt>Size</dt><dd>{animal.size}</dd></div><div><dt>Gender</dt><dd>{animal.sex}</dd></div>{animal.weight !== null && <div><dt>Weight</dt><dd>{animal.weight} lb</dd></div>}{animal.breed && <div><dt>Reported breed</dt><dd>{animal.breed}</dd></div>}</dl><Link className="button" href="/info/adoption">Learn about adoption <span aria-hidden="true">→</span></Link><p className="small-note">Fictional animal profile for the local demo.</p></div><div className="profile-story"><h2>A little about {animal.name}</h2>{animal.description.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}{animal.careNeeds && <><h2>Care needs</h2><p>{animal.careNeeds}</p></>}<h2>Finding the right home</h2><dl className="compatibility-list">{assessments.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{assessmentLabels[item.value] || 'Not yet assessed'}</dd></div>)}</dl>{animal.compatibilityNotes && <p>{animal.compatibilityNotes}</p>}<p className="small-note">Compatibility is based on the recorded assessment. Discuss individual needs with the rescue before making a decision.</p></div></article></main>
}
