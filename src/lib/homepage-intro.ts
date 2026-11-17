import type { SerializedLinkNode, SerializedParagraphNode, SerializedTextNode } from '@payloadcms/richtext-lexical'

const element = { format: '' as const, indent: 0, version: 1, direction: null }

function text(value: string): SerializedTextNode {
  return { type: 'text', version: 1, text: value, detail: 0, format: 0, mode: 'normal', style: '' }
}

function paragraph(...parts: (string | SerializedLinkNode)[]): SerializedParagraphNode {
  return { ...element, type: 'paragraph', textFormat: 0, textStyle: '', children: parts.map(part => typeof part === 'string' ? text(part) : part) }
}

/** Shared by the CMS defaults, initial seed, and public fallback. */
export const defaultHomepageIntro = {
  heading: 'Pets4Luv Foundation',
  body: {
    root: {
      ...element,
      type: 'root',
      children: [
        paragraph('We are a volunteer-run, no-kill cat and dog rescue in Freeport, New York. We rescue, rehabilitate, and rehome animals, with a focus on seniors and animals who are injured, ill, disabled, or have other special needs. We give them a safe place to rest and recover at their own pace.'),
        paragraph('We rely on ', { ...element, type: 'link', version: 3, fields: { linkType: 'custom', newTab: false, url: '/donate' }, children: [text('your donations')] }, ' to give animals the care they need and the chance to find a loving home.'),
      ],
    },
  },
}
