import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { lexicalEditor, BoldFeature, ItalicFeature, ParagraphFeature, HeadingFeature, FixedToolbarFeature, LinkFeature, UnorderedListFeature, OrderedListFeature } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import { Users } from './collections/Users'
import { Media, IntakeFiles } from './collections/Media'
import { Animals } from './collections/Animals'
import { Knowledge } from './collections/Knowledge'
import { Pages } from './collections/Pages'
import { Intakes } from './collections/Intakes'
import { Homepage } from './globals/Homepage'
import { HomepageIntro } from './globals/HomepageIntro'
import { WebsiteSettings } from './globals/WebsiteSettings'
import { privateBlobAdapter } from './lib/private-blob-storage'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const secret = process.env.PAYLOAD_SECRET
if (!secret || secret.length < 32) throw new Error('Run npm run setup to configure a secure PAYLOAD_SECRET (at least 32 characters).')

const isVercelDeployment = process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'development'
const tursoURL = process.env.TURSO_DATABASE_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN
const blobToken = process.env.BLOB_READ_WRITE_TOKEN

if ((isVercelDeployment || tursoURL || tursoAuthToken) && (!tursoURL || !tursoAuthToken || !blobToken)) {
  throw new Error('Hosted Payload requires TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and BLOB_READ_WRITE_TOKEN.')
}
if (isVercelDeployment && tursoURL?.startsWith('file:')) {
  throw new Error('Vercel requires a remote Turso database.')
}

// Vercel has multiple hostnames per deployment. Keep file and admin links on the active host.
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || (isVercelDeployment ? '' : 'http://localhost:3000')
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter(Boolean)
  .map(host => `https://${host}`)
const csrf = [serverURL, ...vercelOrigins].filter(Boolean)
if (isVercelDeployment && csrf.length === 0) {
  throw new Error('Enable Vercel system environment variables so Payload can verify the preview origin.')
}
const storageAdapter = tursoURL && blobToken ? privateBlobAdapter(blobToken) : null

export default buildConfig({
  secret,
  serverURL,
  admin: { user: 'users', meta: { titleSuffix: ' · Pets4Luv Admin' }, importMap: { baseDir: dirname }, components: { beforeNavLinks: ['./components/admin/PagesNav#AnimalsNav'], afterNavLinks: ['./components/admin/PagesNav#PagesNav'] } },
  collections: [Users, Animals, Knowledge, Pages, Media, Intakes, IntakeFiles], globals: [HomepageIntro, Homepage, WebsiteSettings],
  editor: lexicalEditor({ features: [FixedToolbarFeature(), ParagraphFeature(), HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }), BoldFeature(), ItalicFeature(), LinkFeature({ enabledCollections: ['animals', 'pages', 'knowledge'] }), UnorderedListFeature(), OrderedListFeature()] }),
  db: sqliteAdapter({
    client: tursoURL
      ? { url: tursoURL, authToken: tursoAuthToken }
      : { url: process.env.DATABASE_URL || 'file:./data/rescue.db' },
    push: !tursoURL || process.env.TURSO_PUSH_SCHEMA === 'true',
  }),
  plugins: storageAdapter ? [cloudStoragePlugin({
    collections: {
      media: { adapter: storageAdapter, prefix: 'media' },
      'intake-files': { adapter: storageAdapter, prefix: 'intake-files' },
    },
    useCompositePrefixes: true,
  })] : [],
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  upload: { limits: { fileSize: (isVercelDeployment ? 4 : 10) * 1024 * 1024 }, abortOnLimit: true },
  graphQL: { disable: true },
  csrf,
})
