import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor, BoldFeature, ItalicFeature, ParagraphFeature, HeadingFeature, FixedToolbarFeature, LinkFeature, UnorderedListFeature, OrderedListFeature } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import { Users } from './collections/Users'
import { Media, IntakeFiles } from './collections/Media'
import { Animals } from './collections/Animals'
import { Knowledge } from './collections/Knowledge'
import { Pages } from './collections/Pages'
import { Intakes } from './collections/Intakes'
import { Homepage } from './globals/Homepage'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const secret = process.env.PAYLOAD_SECRET
if (!secret || secret.length < 32) throw new Error('Run npm run setup to configure a secure PAYLOAD_SECRET (at least 32 characters).')

export default buildConfig({
  secret,
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  admin: { user: 'users', meta: { titleSuffix: ' · Pets4Luv Admin' }, importMap: { baseDir: dirname } },
  collections: [Users, Animals, Knowledge, Pages, Media, Intakes, IntakeFiles], globals: [Homepage],
  editor: lexicalEditor({ features: [FixedToolbarFeature(), ParagraphFeature(), HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }), BoldFeature(), ItalicFeature(), LinkFeature({ enabledCollections: ['animals', 'knowledge'] }), UnorderedListFeature(), OrderedListFeature()] }),
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URL || 'file:./data/rescue.db' }, push: true }),
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  upload: { limits: { fileSize: 10 * 1024 * 1024 }, abortOnLimit: true },
  graphQL: { disable: true },
  csrf: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
})
