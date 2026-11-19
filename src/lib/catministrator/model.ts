import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { featuredAnimalLimit } from '../featured-animals'
import { animalDraftRequest, DeleteRequestError, DraftRequestError, featuredDraftRequest, featuredReplacementRequest, leadDraftRequest, type DraftRequest } from './requests'

const fields = ['summary', 'description', 'breed', 'status'] as const
const nullableText = { type: ['string', 'null'] }
const schema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['animal', 'featured', 'lead', 'replace-featured', 'delete', 'clarify'] },
    animal: nullableText,
    replacement: nullableText,
    animals: { type: 'array', items: { type: 'string' } },
    ...Object.fromEntries(fields.map(field => [field, nullableText])),
  },
  required: ['action', 'animal', 'replacement', 'animals', ...fields],
  additionalProperties: false,
}

export function readModelDraftOutput(text: string): DraftRequest {
  const data: unknown = JSON.parse(text)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid model response')
  const result = data as Record<string, unknown>
  if (result.action === 'animal') {
    const patch = Object.fromEntries(fields.filter(field => result[field] != null).map(field => [field, result[field]]))
    return animalDraftRequest(result.animal, patch)
  }
  if (result.action === 'lead') return leadDraftRequest(result.animal)
  if (result.action === 'replace-featured') return featuredReplacementRequest(result.animal, result.replacement)
  if (result.action === 'featured') return featuredDraftRequest(result.animals)
  if (result.action === 'delete') throw new DeleteRequestError()
  if (result.action === 'clarify') {
    throw new DraftRequestError('Tell me the change you want and name the animal. For example, “Make Tiny the lead featured animal” or “Set Fig’s summary to Sweet and playful.”')
  }
  throw new Error('Invalid model action')
}

export function openAIInterpreter({
  apiKey, viaGateway = false, model = viaGateway ? 'openai/gpt-6-luna' : 'gpt-6-luna', requestLimit, usageDirectory,
}: {
  apiKey: string
  viaGateway?: boolean
  model?: string
  requestLimit: number
  usageDirectory: string
}) {
  const endpoint = viaGateway ? 'https://ai-gateway.vercel.sh/v1/responses' : 'https://api.openai.com/v1/responses'
  const reasoning = model === 'gpt-6-luna' || model === 'openai/gpt-6-luna' ? { effort: 'medium' } : undefined

  // Reserve before sending so concurrent requests and restarts share the pilot cap.
  async function reserve() {
    await mkdir(usageDirectory, { recursive: true, mode: 0o700 })
    for (let slot = 1; slot <= requestLimit; slot++) {
      try {
        await writeFile(path.join(usageDirectory, String(slot)), '', { flag: 'wx', mode: 0o600 })
        return
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
    throw new DraftRequestError('The AI pilot has reached its request limit. Use /help for the direct draft commands.')
  }

  return async (message: string): Promise<DraftRequest> => {
    await reserve()
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model, reasoning, store: false, max_output_tokens: 1200,
        instructions: [
          'Extract one draft request for a cat and dog rescue CMS from the message.',
          'Supported actions are editing one existing animal, setting the lead featured animal, replacing one featured animal in its current slot, and replacing the entire featured list.',
          'For an edit, use the exact animal name or slug supplied by the editor. Supported fields are summary, description, reported breed, and adoption status.',
          'Only include fields the editor explicitly asks to change. Use the text they supplied. Never invent facts or rewrite other fields.',
          'Use available, on-hold, or adopted for status. Pending means on-hold.',
          'When the editor asks to set or change the first, lead, or spotlight animal alone, use lead and put that name in animal. For example, “set first featured animal to be Tiny” is a lead request with animal Tiny.',
          'Use replace-featured for a request to swap one named featured animal for another, keeping the other positions. For example, “replace Tiny with Mocachina in featured list” uses Tiny in animal and Mocachina in replacement. Copy both names as supplied, including any typos. Do not invent a full list.',
          `For a full featured list, require 1–${featuredAnimalLimit} exact names or slugs in the requested homepage order.`,
          'If the editor asks to delete any stored content, including an animal, page, or photo, use delete even if other edits were requested. Updating the featured list is not deleting a record.',
          'For an ambiguous, incomplete, unsupported, or multi-action request, use clarify. Use null for unused fields and an empty array for unused animals.',
        ].join(' '),
        input: message,
        text: { format: { type: 'json_schema', name: 'catministrator_draft', strict: true, schema } },
      }),
    })
    if (!response.ok) throw new Error('Model request failed with HTTP ' + response.status)
    const result = await response.json() as {
      status?: string
      output?: { type: string; content?: { type: string; text?: string }[] }[]
    }
    const text = result.output?.filter(item => item.type === 'message')
      .flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text
    if (result.status !== 'completed' || !text) throw new Error('Model did not return a draft')
    return readModelDraftOutput(text)
  }
}
