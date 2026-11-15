import path from 'node:path'
import { readFile, mkdir, cp, readdir, lstat, access } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'

const [sourceArg, targetArg] = process.argv.slice(2)
if (!sourceArg || !targetArg) throw new Error('Usage: npm run restore -- backups/BACKUP_NAME /absolute/path/to/NEW-empty-restore-directory. Never restore over the running app.')
const source = path.resolve(sourceArg)
const target = path.resolve(targetArg)
if (target === process.cwd() || target.startsWith(`${source}${path.sep}`)) throw new Error('Restore requires a new separate directory.')
try { await access(target); throw new Error('Restore target already exists. Choose a new directory to preserve all existing files.') } catch (error) { if (error.code !== 'ENOENT') throw error }
const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'))
if (manifest.format !== 1 || manifest.database !== 'data/rescue.db') throw new Error('Unrecognized backup format.')
async function rejectSymlinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if ((await lstat(file)).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${file}`)
    if (entry.isDirectory()) await rejectSymlinks(file)
  }
}
await rejectSymlinks(source)
const db = new DatabaseSync(path.join(source, 'data/rescue.db'), { readOnly: true })
try { if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Backup integrity check failed.') } finally { db.close() }
await mkdir(target, { recursive: false })
await cp(path.join(source, 'data'), path.join(target, 'data'), { recursive: true })
await cp(path.join(source, 'uploads'), path.join(target, 'uploads'), { recursive: true })
console.log(`Verified and restored database and public/private uploads to ${target}. The running application was not changed.`)
