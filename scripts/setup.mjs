import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

await Promise.all(['data', 'uploads/public', 'uploads/private', 'backups'].map((dir) => mkdir(dir, { recursive: true })))
let existing = ''
try { existing = await readFile('.env', 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
if (!/^PAYLOAD_SECRET=.{32,}$/m.test(existing)) {
  if (/^PAYLOAD_SECRET=.+$/m.test(existing)) throw new Error('Existing PAYLOAD_SECRET is too short. Preserve it separately before changing it; changing secrets invalidates sessions.')
  existing = existing.replace(/^PAYLOAD_SECRET=.*\n?/m, '')
  existing += `${existing && !existing.endsWith('\n') ? '\n' : ''}PAYLOAD_SECRET=${randomBytes(48).toString('hex')}\n`
}
if (!/^DATABASE_URL=/m.test(existing)) existing += 'DATABASE_URL=file:./data/rescue.db\n'
if (!/^NEXT_PUBLIC_SERVER_URL=/m.test(existing)) existing += 'NEXT_PUBLIC_SERVER_URL=http://localhost:3000\n'
if (!/^AI_ENABLED=/m.test(existing)) existing += 'AI_ENABLED=false\n'
if (!/^NEXT_TELEMETRY_DISABLED=/m.test(existing)) existing += 'NEXT_TELEMETRY_DISABLED=1\n'
await writeFile('.env', existing, { mode: 0o600 })
console.log('Local folders and .env are ready. No account credentials were created. Start the app and create the first administrator at /admin.')
