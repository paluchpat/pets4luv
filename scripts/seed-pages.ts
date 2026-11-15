import { getPayload } from 'payload'
import config from '../src/payload.config'
import { seedPages } from './page-seeds'

const payload = await getPayload({ config })
try {
  const { created, refreshedContact } = await seedPages(payload)
  if (created.length) console.log(`Created missing pages: ${created.join(', ')}.`)
  if (refreshedContact) console.log('Removed the placeholder from the original Contact starter.')
  if (!created.length && !refreshedContact) console.log('All starter pages already exist. No page content was changed.')
} finally { await payload.destroy() }
