import { getPayload } from 'payload'
import config from '../src/payload.config'
import { seedMissingPages } from './page-seeds'

const payload = await getPayload({ config })
try {
  const created = await seedMissingPages(payload)
  console.log(created.length ? `Created missing pages: ${created.join(', ')}. Existing pages were preserved.` : 'Donate and Contact already exist. No page content was changed.')
} finally { await payload.destroy() }
