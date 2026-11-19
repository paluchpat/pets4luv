import type { Payload } from 'payload'
import type { User } from '../../payload-types'

export function isTelegramUserID(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value))
}

export function isEditor(user: User | undefined | null): user is User {
  return user?.role === 'admin' || user?.role === 'editor'
}

export async function linkedTelegramEditor(payload: Payload, id: number, date: number) {
  const { docs: [user] } = await payload.find({
    collection: 'users', where: { telegramUserId: { equals: String(id) } }, depth: 0, limit: 1, overrideAccess: true,
  })
  if (!isEditor(user) || !user.telegramLinkedAt) return
  const linkedAt = Math.floor(Date.parse(user.telegramLinkedAt) / 1000)
  if (date >= linkedAt) return user
}
