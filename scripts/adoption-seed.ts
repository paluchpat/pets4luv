import type { Payload } from 'payload'
import { body, link, orderedList, paragraph, seedKnowledgeArticle } from './knowledge-seeds'

const demo = {
  title: 'Find your new best friend',
  source: 'Fictional demonstration fixture',
  reviewer: 'Demo content',
  reviewedAt: '2026-11-07',
  body: body(paragraph('This is a fictional local demonstration, not an operating rescue. In a real adoption process, the rescue will discuss your household, help you meet an animal and explain its approved adoption policies. Contact the rescue directly for current fees, application requirements and availability.')),
}

const catSource = 'https://www.pets4luv.org/Cat-Adoption-Information'
const dogSource = 'https://www.pets4luv.org/Dog-Adoption-Information'
const published = { category: 'adoption', reviewer: null, reviewedAt: null, _status: 'published' } as const

const adoption = {
  ...published,
  slug: 'adoption',
  title: 'How adoption works',
  source: `${catSource}, ${dogSource}`,
  body: body(
    paragraph('Adoption usually takes 3 to 7 days after Pets4Luv receives your signed application. Email ', link('info@pets4luv.org', 'mailto:info@pets4luv.org'), ' or call ', link('(516) 860-7057', 'tel:+15168607057'), ' for the current application.'),
    orderedList([
      'Complete the application. Include any required addenda, three personal references who aren’t relatives, and one veterinary reference.',
      'Prepare for a home check. Pets must be allowed at your address. If you rent, provide your landlord’s contact information. Pets4Luv checks that the home is safe for the animal.',
      'Meet the animal. All household members meet the animal, and any pets already at home have at least one introduction. Existing pets must be spayed or neutered and up to date on vaccines.',
    ]),
    paragraph('Pets4Luv generally spays or neuters animals before adoption. If surgery must be delayed for medical reasons, sign a spay or neuter agreement and arrange an appointment with the veterinarian Pets4Luv designates.'),
    paragraph('Pets4Luv may follow up by phone or with a home visit. Contact the rescue for the current payment, medical support, and refund terms in the Adoption Agreement.'),
  ),
}

const catAdoption = {
  ...published,
  slug: 'cat-adoption',
  title: 'Cat adoption',
  source: catSource,
  body: body(
    paragraph('Cats adopted through Pets4Luv live indoors as companions. Declawing and devocalization are permitted only when medically necessary.'),
    paragraph('Cat adoption includes rabies and FVRCP vaccinations, testing for FIV, FeLV, and heartworm, deworming, spay or neuter surgery, and a microchip.'),
  ),
}

const dogAdoption = {
  ...published,
  slug: 'dog-adoption',
  title: 'Dog adoption',
  source: dogSource,
  body: body(
    paragraph('Dogs adopted through Pets4Luv live indoors as companions. Devocalization, ear cropping, and tail docking are permitted only when medically necessary. Pets4Luv encourages obedience training and advises against shock or prong collars.'),
    paragraph('Pools and other water features must have safeguards that keep dogs out of the water. Pets4Luv generally requires an enclosed area with a physical fence. It does not accept electronic fences and considers homes without fencing individually.'),
    paragraph('Dog adoption includes age-appropriate vaccinations, heartworm and fecal testing, deworming, spay or neuter surgery, and a microchip.'),
  ),
}

export async function seedAdoption(payload: Payload) {
  return {
    adoption: await seedKnowledgeArticle(payload, adoption, demo),
    'cat-adoption': await seedKnowledgeArticle(payload, catAdoption),
    'dog-adoption': await seedKnowledgeArticle(payload, dogAdoption),
  }
}
