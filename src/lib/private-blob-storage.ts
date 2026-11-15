import { readFile } from 'node:fs/promises'
import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import { getStorageFilePath } from '@payloadcms/plugin-cloud-storage/utilities'
import { del, get, put } from '@vercel/blob'

export function privateBlobAdapter(token: string): Adapter {
  return ({ collection, prefix = collection.slug }) => ({
    name: 'private-vercel-blob',
    async handleUpload({ file, storageFilePath }) {
      const data = file.tempFilePath ? await readFile(file.tempFilePath) : file.buffer
      await put(storageFilePath, data, { access: 'private', contentType: file.mimeType, token })
    },
    handleDelete: ({ storageFilePath }) => del(storageFilePath, { token }),
    async staticHandler(req, { doc, params: { filename, prefix: prefixQueryParam } }) {
      // Payload authorizes the collection read before calling this handler.
      const pathname = await getStorageFilePath({
        collection, collectionPrefix: prefix, doc, filename, prefixQueryParam, req, useCompositePrefixes: true,
      })
      const result = await get(pathname, { access: 'private', token })
      if (result?.statusCode !== 200) return new Response(null, { status: 404 })

      return new Response(result.stream, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': result.blob.contentType,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    },
  })
}
