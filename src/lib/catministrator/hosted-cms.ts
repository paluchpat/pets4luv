import { AnimalNameError, DraftRequestError, type AnimalNameIssue, type DraftRequest } from './requests'
import type { DraftReceipt } from './drafts'

export function hostedCatministratorCMS(origin: string, key: string, bypass?: string) {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash || key.length < 32) {
    throw new Error('The hosted Catministrator CMS requires an HTTPS origin and service key.')
  }
  const endpoint = new URL('/api/catministrator', base)
  const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json',
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
  }
  async function call<T>(body: object): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(18000),
    })
    if (response.status === 422) {
      const error = await response.json() as { message: string; nameIssue?: AnimalNameIssue }
      if (error.nameIssue) throw new AnimalNameError(error.message, error.nameIssue)
      throw new DraftRequestError(error.message)
    }
    if (!response.ok) throw new Error('Hosted Catministrator CMS request failed.')
    return await response.json() as T
  }
  return {
    cmsOrigin: base.origin,
    isLinked: (id: number, date: number) => call<boolean>({ action: 'linked', id, date }),
    save: (id: number, date: number, draft: DraftRequest, featuredVersion?: string | null) =>
      call<DraftReceipt>({ action: 'save', id, date, draft, featuredVersion }),
    reviewAnimal: (id: number, date: number, animal: string) => call<DraftReceipt>({ action: 'review-animal', id, date, animal }),
    publish: (id: number, date: number, token: string) => call<DraftReceipt>({ action: 'publish', id, date, token }),
    undo: (id: number, date: number, token: string) => call<DraftReceipt>({ action: 'undo', id, date, token }),
  }
}
