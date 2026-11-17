import type { Field, GlobalConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'
import { defaultWebsiteSettings, normalizeVenmoHandle, validatePhone, validateVenmoHandle, validateWebsiteUrl, type WebsiteSettings as Settings } from '../lib/website-settings'

const trim = ({ value }: { value?: unknown }) => typeof value === 'string' ? value.trim() : value
const url = (name: keyof Settings, label: string): Field => ({
  name, label, type: 'text', defaultValue: defaultWebsiteSettings[name], validate: validateWebsiteUrl,
  hooks: { beforeValidate: [trim] },
  admin: { description: 'Paste the full URL. Leave blank to hide this link on the website.' },
})

export const WebsiteSettings: GlobalConfig = {
  slug: 'website-settings',
  label: 'Website Settings',
  access: { read: publishedOrStaff, update: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, max: 30 },
  admin: {
    group: false,
    description: 'Shared contact details, social links, adoption listings, and donation links. Publish changes to update the website.',
    preview: () => '/api/preview?path=/contact',
    livePreview: { url: '/api/preview?path=/contact' },
  },
  fields: [{
    type: 'tabs',
    admin: { className: 'cms-settings-tabs' },
    tabs: [
      { label: 'Contact', fields: [
        { name: 'address', label: 'Address', type: 'textarea', required: true, maxLength: 500, defaultValue: defaultWebsiteSettings.address, hooks: { beforeValidate: [trim] }, admin: { description: 'Used in the footer, contact page, application instructions, donation mailing address, and Google Maps.' } },
        { name: 'emailAddress', label: 'Email address', type: 'email', required: true, defaultValue: defaultWebsiteSettings.emailAddress, hooks: { beforeValidate: [trim] } },
        { name: 'phone', label: 'Phone', type: 'text', required: true, defaultValue: defaultWebsiteSettings.phone, validate: validatePhone, hooks: { beforeValidate: [trim] }, admin: { description: 'Include the area code. Click-to-call links update automatically.' } },
      ] },
      { label: 'Social media', fields: [
        url('instagramUrl', 'Instagram URL'),
        url('facebookUrl', 'Facebook URL'),
        url('tiktokUrl', 'TikTok URL'),
      ] },
      { label: 'Adoption listings', fields: [
        url('petfinderUrl', 'Petfinder URL'),
        url('adoptAPetUrl', 'Adopt a Pet URL'),
      ] },
      { label: 'Donations', fields: [
        url('zeffyUrl', 'Zeffy URL'),
        url('paypalUrl', 'PayPal URL'),
        { name: 'venmoHandle', label: 'Venmo handle', type: 'text', defaultValue: defaultWebsiteSettings.venmoHandle, validate: validateVenmoHandle, hooks: { beforeValidate: [({ value }) => typeof value === 'string' ? normalizeVenmoHandle(value) : value] }, admin: { description: 'Enter the username with or without @. This is the label shown on the donation button.' } },
        url('venmoUrl', 'Venmo URL'),
      ] },
    ],
  }],
}
