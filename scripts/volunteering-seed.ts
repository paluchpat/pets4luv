import type { Payload } from 'payload'
import { body, link, paragraph, seedKnowledgeArticle } from './knowledge-seeds'

const demo = {
  title: 'A little of your time. A lot of love.',
  source: 'Fictional demonstration fixture',
  reviewer: 'Demo content',
  reviewedAt: '2026-11-07',
  body: body(paragraph('This fictional demonstration illustrates where approved volunteering information will appear. A real rescue may need help with animal care, transport, events and foster support. Ask the organization about its current opportunities, training and age requirements.')),
}

const volunteering = {
  slug: 'volunteering',
  category: 'volunteering',
  title: 'Volunteer with Pets4Luv',
  body: body(
    paragraph('Spend time with the animals in our care and experience the love and companionship they bring. Knowing you’ve helped save a life is a feeling that stays with you. These dogs and cats will give that love right back and show you just how special they are.'),
    paragraph('Pets4Luv is a registered 501(c)(3) nonprofit rescue powered entirely by volunteers who care deeply about our dogs and cats. Volunteers feed and socialize the animals and help with their daily care. Our goal is to give each animal a second chance and help them find their forever family.'),
    paragraph('To join us, email ', link('{{emailAddress}}', '{{emailHref}}'), ' or call ', link('{{phone}}', '{{phoneHref}}'), ' to ask for a volunteer application.'),
  ),
  source: 'https://www.pets4luv.org/volunteering',
  reviewer: null,
  reviewedAt: null,
  _status: 'published',
} as const

export function seedVolunteering(payload: Payload) {
  return seedKnowledgeArticle(payload, volunteering, demo)
}
