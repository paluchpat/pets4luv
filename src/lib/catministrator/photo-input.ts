import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { DraftRequestError } from './requests'

export type TelegramFile = { file_id: string; file_unique_id: string; file_size?: number; mime_type?: string }
export type PreparedImage = { data: Buffer; digest: string }

const maxImageBytes = 8 * 1024 * 1024

export async function fetchTelegramImage(
  getFile: (id: string) => Promise<{ file_path?: string; file_size?: number }>,
  token: string,
  input: TelegramFile,
  signal: AbortSignal,
): Promise<PreparedImage> {
  if ((input.file_size || 0) > maxImageBytes) {
    throw new DraftRequestError('That image is too large. Send it as a Telegram photo or as a JPG, PNG, or WebP under 8 MB.')
  }
  const file = await getFile(input.file_id)
  const location = file.file_path
  if (!location || !/^[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(location) || (file.file_size || 0) > maxImageBytes) {
    throw new DraftRequestError('I couldn’t download that image. Try resending it as a Telegram photo.')
  }
  const response = await fetch('https://api.telegram.org/file/bot' + token + '/' + location, {
    redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  if (!response.ok || !response.body) throw new DraftRequestError('The image download failed. Try sending it again.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > maxImageBytes) throw new DraftRequestError('That image is too large. Send it again as a Telegram photo.')
      chunks.push(next.value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  try {
    const image = sharp(Buffer.concat(chunks), { limitInputPixels: 25_000_000 })
    const { format } = await image.metadata()
    if (!format || !['jpeg', 'png', 'webp'].includes(format)) throw new Error('Unsupported image')
    const data = await image.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    return { data, digest: createHash('sha256').update(data).digest('hex') }
  } catch {
    throw new DraftRequestError('I couldn’t open that image. Send a JPG, PNG, or WebP.')
  }
}
