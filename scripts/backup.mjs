import path from 'node:path'
import { mkdir, cp, readFile, writeFile, lstat, readdir } from 'node:fs/promises'
import { DatabaseSync, backup } from 'node:sqlite'

if (!process.argv.includes('--confirm-stopped')) throw new Error('Stop the app first, then run npm run backup -- --confirm-stopped so database and files describe the same moment.')
const env = await readFile('.env', 'utf8')
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.replace(/^['"]|['"]$/g, '') || 'file:./data/rescue.db'
if (!url.startsWith('file:')) throw new Error('This backup command supports local SQLite files only.')
const database = path.resolve(url.slice(5))
const destination = path.resolve('backups', new Date().toISOString().replace(/[:.]/g, '-'))
async function rejectSymlinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if ((await lstat(file)).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${file}`)
    if (entry.isDirectory()) await rejectSymlinks(file)
  }
}
await rejectSymlinks('uploads')
await mkdir(path.join(destination, 'data'), { recursive: true })
const db = new DatabaseSync(database, { readOnly: true })
try { await backup(db, path.join(destination, 'data/rescue.db')) } finally { db.close() }
await cp('uploads', path.join(destination, 'uploads'), { recursive: true })
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ format: 1, createdAt: new Date().toISOString(), database: 'data/rescue.db', media: ['uploads/public', 'uploads/private'], note: 'Credentials are intentionally excluded. Keep the original .env securely.' }, null, 2))
console.log(`Backup created: ${destination}`)
