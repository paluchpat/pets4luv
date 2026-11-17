import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { ServerProps } from 'payload'

export function AdminBrand({ payload }: ServerProps) {
  return <Link className="cms-brand" href={payload.config.routes.admin}><img src="/images/heart-paw.svg" alt="" width="38" height="38" /><span>Pets4Luv<small>Website workspace</small></span></Link>
}
export function AdminLogo() {
  return <div className="cms-login-brand"><img src="/images/heart-paw.svg" alt="" width="52" height="52" /><span>Pets4Luv<small>Website workspace</small></span></div>
}
export function AdminIcon() {
  return <img className="cms-app-icon" src="/images/heart-paw.svg" alt="Pets4Luv" width="26" height="26" />
}
export function ViewWebsite() {
  return <a className="cms-view-website" href="/" target="_blank" rel="noopener noreferrer">View website<ArrowUpRight aria-hidden="true" /><span className="cms-sr-only"> (opens in a new tab)</span></a>
}
