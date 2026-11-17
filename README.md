# Pets4Luv local prototype

A Payload CMS + Next.js website based on the approved Pets4Luv desktop and mobile mockups. SQLite and uploaded files stay on this computer. All seeded animal records and policy examples are fictional demonstration content.

## Run locally

Use Node **24.22.2** (see `.nvmrc`) and npm. This checkout also has an ignored project-local Node runtime; the wrapper below selects it without changing your system Node.

```sh
./scripts/local.sh setup
./scripts/local.sh seed
./scripts/local.sh dev
```

Open http://localhost:3000 for the website and http://localhost:3000/admin for Payload. The server binds to loopback only. Create your first administrator in Payload's setup screen; no shared administrator password is seeded.

On a fresh checkout with supported Node installed, run `npm ci`, then `npm run setup`, `npm run seed`, and `npm run dev`. Setup creates a random secret in the ignored `.env`; seed preserves existing records. Keep the original secret when moving an existing database.

## Protected Vercel preview

Enable Vercel Authentication and system environment variables. Add a separate `PAYLOAD_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN` for a **private** Vercel Blob store, and `AI_ENABLED=false` to the Preview environment. Leave `NEXT_PUBLIC_SERVER_URL` unset so Payload uses the current preview hostname.

Initialize an empty preview database from a clean checkout using an environment file stored outside the checkout with the same preview credentials. This command uses the committed fictional fixtures and demo images.

```sh
NODE_ENV=development TURSO_PUSH_SCHEMA=true node --env-file=/absolute/path/to/preview.env --import tsx scripts/seed.ts
```

Keep `TURSO_PUSH_SCHEMA` unset on Vercel. On the protected preview, browse to `/admin` to create the first administrator. Both photo collections use the private Blob store. Payload serves approved animal photos through its regular file routes. Retired intake-file routes reject access, including staff requests. Browser uploads on Vercel are limited to 4 MiB per file.

The build runs `prepare:cms` using the configured database credentials. It adds Main Menu storage and copies the current navigation once; later builds preserve published changes, drafts, and intentionally removed links. It initializes Website Settings with the current public contact and donation details, preserving existing edits and drafts. It adds the Homepage Intro tables and initializes the current introduction when absent. It also moves adoption and volunteering into Pages with their drafts and revision history. A migration record for each article keeps later builds from repeating the move or replacing edits. The build adds Poppy’s extra demo photos in two one-time batches (two photos, then three more), retaining the main photo and skipping real listings or pending drafts. Later deployments preserve editorial removals.

## Content editing

The sidebar and dashboard follow this order: Animals, Homepage, Pages, Settings. Users is under Settings alongside Website Settings and Main Menu. Animal editing places required fields before optional details. Weight is optional, accepts decimals, and appears on the animal’s public profile only when entered. Rescue intake ID and Internal notes remain available; unused age-reference and energy-level controls are retired.

- **Settings → Main Menu:** add, remove, and drag links into the order you want. Select a published page, a built-in page (Home, Adopt, or Forms and applications), or enter a custom address. Choose Submenu to group links. Edit or hide the highlighted Donate button separately. Check **Also show in the footer** to keep its label and destination consistent with the main menu. Save a draft and use Preview before publishing; published changes appear without a code change or redeploy. Unpublished or deleted pages are hidden from public menus. Longer menus use the compact navigation when they no longer fit.
- **Settings → Website Settings:** edit the shared address, email, phone, social profiles, adoption directories, and donation links. Save a draft to preview, then publish to update the website. Existing contact references in page text also follow these settings. Leave optional URLs blank to hide those links; TikTok starts blank. In new rich text, shared values can be inserted as {{address}}, {{emailAddress}}, {{phone}}, or any of the other settings field names.

- **Animal profile gallery:** swipe photos on touchscreens, use the themed arrows or arrow keys, or tap a thumbnail. The thumbnail strip scrolls horizontally within the main photo’s width.
- **Animals:** browse photo cards, search profiles, or filter Cats and Dogs. Cards show availability, publication state, photo count, and published homepage features. Click a card to edit in the side drawer or choose **Add an animal**. The Details, Photos, Story, Friendly with, and Editor notes tabs keep profile fields organized without changing existing data. Upload approved public photos in Photos and drag rows to choose the main image. Save a draft to keep changes private; publish to update the website. Adoption status is separate from draft/publication state. Marking an animal on hold or adopted removes it from available-animal searches and homepage highlights. The dashboard shows the five most recently updated profiles in a compact, horizontally scrollable strip with small thumbnails and status labels. The full Animals gallery fits five photo cards across on desktop and uses fewer columns as the available space narrows.
- **Homepage → Homepage Intro:** edit the foundation heading and rich-text introduction, including the donation link. Save a draft and use the authenticated preview before publishing.
- **Homepage → Homepage Highlights:** edit the featured-animal introduction, select available animals, and drag the rows to order them. Use the authenticated preview before publishing.
- **Pages:** open a page directly from this sidebar group, or use **New page** to add one. Existing page links use the same labels as the public menu. Edit the body with the rich-text toolbar and save a draft before publishing. Adoption and volunteering keep their `/info/adoption` and `/info/volunteering` addresses; a published page with slug `donate` appears at `/donate`. Publish a new page first, then add it under **Settings → Main Menu**. Removing a menu link does not delete the page.
- **Retired intake storage:** the Intake section and private-file tools are disabled. Existing records and files are retained as inaccessible storage, not an active workflow. Manage website animal profiles directly in Animals; the rescue uses its own operational system. Future automation can create and update animal drafts directly.
- **Staff:** the administrator can create an editor account for the content manager. Editors can maintain content but cannot assign administrative roles.

Use **unknown** for unassessed compatibility. Public compatibility filters match explicit yes assessments, never unknown or conditional values.

Donate, Contact, and About are local pages. The Donate page lists the rescue’s Zeffy, PayPal, and Venmo links and its mailing address. The providers handle online donations. Contact details can be added through Payload when available. `./scripts/local.sh seed:pages` creates only missing starter pages and preserves existing drafts and published content.

Public content must not send visitors to the former rescue website. Known legacy links in rich text are rewritten to their matching local pages; unrecognized legacy destinations render as ordinary text. This rule also applies to future CMS edits.

## AI remains disabled

The visible chat is an unavailable-state preview. It does not generate responses, send messages to a provider, or infer animal traits. The server chat endpoint also refuses requests. No OpenAI SDK or API key is needed for this build. An environment flag alone must not turn on paid requests.

Credit eligibility, balance, expiry, and billing behavior have **not** been verified. Enabling live visitor/admin AI is a later implementation step after verification and an agreed spending allowance. The manual CMS and gallery work independently of AI.

## Verification

```sh
./scripts/local.sh typecheck
./scripts/local.sh test:backend
./scripts/local.sh test:site
./scripts/local.sh build
```

The hosted preview uses schema synchronization during initial seeding. Before production hosting, introduce reviewed migrations, production backups, email delivery, and deployment-specific configuration. Do not expose this demo as a live adoption system with fictional fixtures.

Initial verification on November 7, 2026: production build and TypeScript checks passed; seven backend integration tests passed; desktop and 320/390px mobile browser checks passed. The manager's own editing/usability session is still pending. Local preview screenshots are in `output/qa`.

Dependency overrides pin patched DOMPurify and happy-dom versions. The installation audit reported no high or critical advisories, with 5 moderate and 7 low advisories remaining; review these again before production deployment.

## Backup and restore

Stop the app before copying its database and uploads together:

```sh
./scripts/local.sh backup -- --confirm-stopped
./scripts/local.sh restore -- backups/BACKUP_NAME /absolute/path/to/a-new-restore-directory
```

Restore verifies SQLite integrity and writes into a new directory; it does not overwrite the working application. Backups include public and private uploads. Preserve `.env` securely and separately; it is intentionally excluded from backups and Git.

## Project layout

- `src/app/(site)` — public homepage, gallery, animal profiles and information pages.
- `src/app/(payload)` — CMS administration, REST API and authenticated preview routes.
- `src/collections`, `src/globals` — content schema and permissions.
- `src/lib/content.ts` — public data projection and shared search queries.
- `public/images` — local demo imagery and original Pets4Luv logo.
- `data`, `uploads`, `backups` — local runtime data, excluded from Git.
- `design/homepage-mockups` — design exploration and approved references.

Approved desktop: `12-editorial-hybrid-refined-v6.png`. Approved mobile: `15-mobile-search-refined-v7-final.png` and `16-mobile-highlights-refined-v7.png`.

Demo animal images were created with the built-in image-generation tool; prompts are recorded in `design/implementation-assets-prompts.json`. The site logo at `public/images/logo.png` is the approved white-outline variation of the original pets4luv.org logo, optimized to 400 × 400 pixels for the header. The original logo is retained at `design/homepage-mockups/pets4luv-logo-original.png`. The animal images are illustrative and must not be represented as real available animals.
