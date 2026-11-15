import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { kind: 'paw' | 'cat' | 'dog' | 'child' | 'chat' | 'arrow' }

export function Icon({ kind, ...props }: IconProps) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {kind === 'arrow' && <><path d="M4 16h24M20 8l8 8-8 8" /></>}
    {kind === 'chat' && <path d="M28 14c0 6-6 10-13 10h-3l-7 5 2-8C4 19 2 17 2 14 2 7 8 3 15 3s13 4 13 11Z" />}
    {kind === 'paw' && <><path fill="currentColor" stroke="none" d="M16 14c-4 0-5 5-8 8-3 4 1 8 5 6 2-1 4-1 6 0 4 2 8-2 5-6-3-3-4-8-8-8Z" /><ellipse cx="6" cy="12" rx="3" ry="4" fill="currentColor" stroke="none" transform="rotate(-25 6 12)"/><ellipse cx="13" cy="7" rx="3" ry="4" fill="currentColor" stroke="none"/><ellipse cx="21" cy="7" rx="3" ry="4" fill="currentColor" stroke="none"/><ellipse cx="27" cy="13" rx="3" ry="4" fill="currentColor" stroke="none" transform="rotate(25 27 13)"/></>}
    {kind === 'cat' && <>
      <path className="icon-outline" d="m6 12-1-9 9 5h5l8-5-1 10c5 10-1 16-10 16S2 23 6 12Z" />
      <path className="icon-details icon-eyes" d="M12 19l1 1m7-1-1 1" />
      <path className="icon-details" d="M15 23l2 1 2-1M4 20l5 1m-5 4 5-1m15-3 5-1m-5 4 5 1" />
    </>}
    {kind === 'dog' && <g transform="translate(0 -2.6)">
      <path className="icon-outline" d="M8 9c-4-5-7 1-6 9 1 4 4 3 7-2m15-7c4-5 7 1 6 9-1 4-4 3-7-2M8 13c0-7 16-7 16 0v8c0 12-16 12-16 0Z" />
      <path className="icon-details icon-eyes" d="M12 16v1m8-1v1" />
      <path className="icon-details" d="M14 22l2 2 2-2m-2 2v4" />
    </g>}
    {kind === 'child' && <>
      <path className="icon-outline" d="M7 13v-1a9 9 0 0 1 18 0v1a3 3 0 0 1 0 6h-.5a9 9 0 0 1-17 0H7a3 3 0 0 1 0-6Z" />
      <path className="icon-details" strokeWidth="3" d="M12 16h.1M20 16h.1" />
      <path className="icon-details" d="M13 21q3 3 6 0M16 5c2 1.5 1.5 4-1 5" />
    </>}
  </svg>
}
