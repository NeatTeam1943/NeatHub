# NEATHUB

Hub site for FRC Team 1943. Every hub is a kit tote; inside a tote, links are game pieces from the tote's season (2012–2026) and sub-hubs are smaller totes. Public to browse, Google sign-in for locked items and editing.

Stack: React + Vite on GitHub Pages, Firebase (Firestore + Google Auth). No Cloud Storage: uploaded images are resized to ≤192px and stored inside the Firestore doc.

## Run locally

```bash
npm install
npm run dev
```

Without a `.env` the app runs in **demo mode**: sample data in `localStorage`, plus a role switcher in the header (guest / member / lead / mentor) to try permissions. Reset demo data by clearing site storage.

## Firebase setup (once)

1. Create (or reuse) a Firebase project. Free Spark plan is enough.
2. **Build → Authentication → Sign-in method:** enable **Google**. Under **Settings → Authorized domains**, add `<owner>.github.io`.
3. **Build → Firestore Database:** create a database (production mode).
4. **Project settings → Your apps → Web app:** copy the config into `.env` (see `.env.example`).
5. Deploy the security rules: `npm run deploy:rules` (uses firebase-tools; run `npx firebase-tools login` and `npx firebase-tools use <project-id>` first).
6. Sign in on the site once, then in the Firestore console open `users/<your uid>` and set `role` to `mentor`. From then on, approve everyone from the **משתמשים** page.

## Deploy

GitHub → **Settings → Pages → Source: GitHub Actions**. Add the four `VITE_FB_*` values as repository **secrets** (they're public in the built JS anyway; access is enforced by the rules). Every push to `main` builds and deploys.

## Permissions

| Role | Can |
|---|---|
| guest / pending | browse; open public links |
| member | + open "members" links |
| lead | + edit everything inside the top-level totes a mentor assigned them (items, labels, **season**, order). Can't create or delete top-level totes. |
| mentor | everything, including users and roles |

Each item's visibility is `public / members / leads / mentors`. A tote's visibility also applies to everything inside it (`effVis`). URLs live in a separate `nodeUrls` collection, so a locked link's URL never reaches a guest's browser. Titles stay visible (shown with a lock).

The hub only hides links. Files in Drive keep their own sharing settings — a Drive file shared "anyone with the link" is still open to anyone who gets the link elsewhere.

## Shareable links

Every hub has its own address built from slugs, e.g. `https://<owner>.github.io/NeatHub/#/software/vision`. Each hub page has a **copy link** button (on phones it opens the share sheet). The slug is set in the hub's editor (English letters, digits, `-`; empty = from the name) and must be unique among its siblings. Changing a slug breaks links already shared. Old `#/h/<id>` links redirect to the new path. A link to a locked hub shows a lock screen with sign-in.

## Data model

- `nodes/{id}` — public: `parentId`, `type` (`hub`/`link`), `title`, `labelMode` (`txt`/`img`/`both`), `labelText`, `imageData` / `imageUrl`, `season` and `slug` (hubs), `piece` (link piece override), `visibility`, `effVis`, `scope` (top-level tote id, or `root`), `order`.
- `nodeUrls/{id}` — `url`, `visibility` (= effVis), `scope`.
- `users/{uid}` — `name`, `email`, `photo`, `role` (`pending`/`member`/`lead`/`mentor`), `scopes` (top-level tote ids a lead may edit).

## Rules tests

`npm run test:rules` runs `tests/rules.test.js` against the Firestore emulator (needs Java).

## Adding a season

Add the pieces to `PIECES` and the season to `SEASONS` in `src/lib/seasons.js`. Each piece draws an SVG in a 100×100 box and says where the label sits (`x`, `y`), its text tone, and an optional max width.
