import type { Payload } from 'payload'
import { body, link, paragraph } from './rich-text-seeds'
import { seedMissingPage } from './page-seeds'

const volunteering = {
  slug: 'volunteering',
  title: 'Volunteer with Pets4Luv',
  body: body(
    paragraph('Spend time with the animals in our care and experience the love and companionship they bring. Knowing you’ve helped save a life is a feeling that stays with you. These dogs and cats will give that love right back and show you just how special they are.'),
    paragraph('Pets4Luv is a registered 501(c)(3) nonprofit rescue powered entirely by volunteers who care deeply about our dogs and cats. Volunteers feed and socialize the animals and help with their daily care. Our goal is to give each animal a second chance and help them find their forever family.'),
    paragraph('To join us, email ', link('{{emailAddress}}', '{{emailHref}}'), ' or call ', link('{{phone}}', '{{phoneHref}}'), ' to ask for a volunteer application.'),
  ),
  _status: 'published',
} as const

export function seedVolunteering(payload: Payload) {
  return seedMissingPage(payload, volunteering)
}
