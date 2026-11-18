import type { FieldAffectingData } from 'payload'
import { isSharedWebsiteUrl } from './website-settings'

/** Preserve approved CMS references instead of URL-encoding their braces. */
export function sharedLinkFields(fields: FieldAffectingData[]): FieldAffectingData[] {
  return fields.map(field => {
    if (field.type !== 'text' || field.name !== 'url') return field
    return {
      ...field,
      hooks: {
        ...field.hooks,
        beforeChange: field.hooks?.beforeChange?.map(hook => args =>
          typeof args.value === 'string' && isSharedWebsiteUrl(args.value) ? args.value : hook(args)),
      },
    }
  })
}
