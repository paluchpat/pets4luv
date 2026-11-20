import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAnimal } from '@/lib/content'
import { AnimalProfile } from '@/components/AnimalProfile'
import { noIndex, pageMetadata, shortDescription } from '@/lib/seo'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const animal = await getAnimal((await params).slug)
  if (!animal) return { title: 'Animal not found', robots: noIndex }
  const status = {
    available: 'available for adoption',
    'on-hold': 'with an adoption pending',
    adopted: 'adopted',
  }[animal.status]
  const title = animal.status === 'available' ? `${animal.name} | ${animal.species === 'cat' ? 'Cat' : 'Dog'} for adoption` : animal.name
  return pageMetadata({
    title,
    description: shortDescription(
      `Meet ${animal.name}, a ${animal.species} ${status} at Pets4Luv Foundation. ${animal.summary || animal.description}`,
      `Meet ${animal.name} at Pets4Luv Foundation.`,
    ),
    path: `/animals/${animal.slug}`,
    image: animal.photo,
  })
}

export default async function AnimalPage({ params }: Props) {
  const animal = await getAnimal((await params).slug)
  if (!animal) notFound()
  return <AnimalProfile animal={animal} />
}
