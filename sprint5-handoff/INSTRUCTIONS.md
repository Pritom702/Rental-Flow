# Sprint 5 — chunks for my groupmates

Sprint 5 is the polish-and-ship sprint: **Bangladeshi Taka currency** across the
whole app, a **rebuilt design system** (sidebar workspace, editorial palette),
**Vercel deployment**, and a new identity feature set — **NID verification for
damage control (F21)**, **user profiles with permanent payment methods (F22)**,
and the **renter identity check before approving a booking (F23)**.

My part (M2 · @pritom702) is already pushed: branch **`s5-m2-platform`**,
commit `8142507`. It covers the Taka formatter, the Vercel deployment split,
the booking-modal fixes and the CRM tier rescale.

The four chunks below are for the rest. Each teammate applies **their** chunk,
commits it **under their own GitHub identity**, pushes, and opens a PR into `main`.

| Chunk | Owner | Branch | Contents |
|-------|-------|--------|----------|
| `chunk1-M1-charts.patch` | **M1 · @shaafin01** | `s5-m1-charts` | Chart palette tokens, Taka in analytics, NID-safe item form label |
| `chunk3-M3-money-docs.patch` | **M3 · Promit** | `s5-m3-money-docs` | Taka in PDFs and statements, Taka-scaled seed prices |
| `chunk4-M4-design-profile.patch` | **M4 · Radowan** | `s5-m4-design-profile` | Design system, app shell, **F21 NID**, **F22 profile + payments**, **F23 renter check** |
| `chunk5-SHARED-bookings.patch` | **see note below** | `s5-shared-bookings` | The four co-authored files |

## How to apply your chunk

From the repository root, on an up-to-date `main`:

```bash
git checkout main && git pull
git checkout -b s5-<your-branch>

# apply your patch (-p1, and -l tolerates Windows/Unix line-ending differences)
patch -p1 -l < sprint5-handoff/chunk<N>-....patch

# M4 only: the seeded demo NID card images
mkdir -p server/uploads
cp sprint5-handoff/assets/demo-nid-*.svg server/src/uploads/

git add -A
git commit -m "feat(F..): <describe your part>"
git push -u origin s5-<your-branch>
```

Then open a Pull Request into `main`.

> **Commit as yourself.** Use your own GitHub account and the email attached to
> it, so the contribution history is genuinely per-person. This is a course rule
> — see `SPRINT_PLAN.md`.

## Merge order matters this time

Unlike Sprint 4, these chunks are **not fully file-disjoint**, because Sprint 5
touched shared plumbing. Merge in this order to avoid conflicts and a broken
`main`:

```
1. s5-m2-platform          (mine — already pushed; money.js + app.js are imported by the rest)
2. s5-m4-design-profile    (styles.css, App.jsx routing, and the profile API the others reference)
3. s5-m1-charts            (uses the chart tokens added in step 2)
4. s5-m3-money-docs        (uses money.js from step 1)
5. s5-shared-bookings      (touches files the others also edit — merge last)
```

**Why my branch has to be first:** `client/src/money.js` is imported by the
analytics charts, the PDF export and the documents page, and `server/src/app.js`
is what mounts every route. Merging chunk 1 or 3 before it will fail to build.

## What is in each chunk

**Chunk 1 — M1, charts & analytics (3 files)**
```
client/src/components/Charts.jsx   chart-only colour tokens, so a category never
                                   borrows a status colour; Taka on axes
client/src/pages/Analytics.jsx     Taka via the shared formatter
client/src/pages/ItemForm.jsx      price labels now read (৳)
```

**Chunk 3 — M3, money & documents (5 files)**
```
client/src/pdf.js                  Taka amounts; PDFs print "BDT" because jsPDF's
                                   Helvetica has no ৳ glyph and would render a box
client/src/pages/Documents.jsx     Taka via the shared formatter
server/src/documentUtils.js        formatMoney now returns BDT
server/src/documentUtils.test.js   assertions updated to match
server/src/seed.js                 demo prices rescaled to realistic Dhaka rates
```

**Chunk 4 — M4, design system + identity (15 files)** — the largest chunk
```
client/src/styles.css              rebuilt design system: warm paper, evergreen +
                                   copper, Fraunces/Inter, sidebar shell, dark mode
client/src/App.jsx                 sidebar workspace shell, grouped nav, route guards
client/src/icons.jsx               new icons (chart, file, users, menu, close, qr…)
client/src/pages/Landing.jsx       empty categories no longer link to dead ends;
                                   featured cards deep-link to their own item
client/src/pages/Dashboard.jsx     stat tiles, collapsible categories, empty states
client/src/pages/Maintenance.jsx   Taka
F21/F22/F23 — new files:
server/src/schema_profile.sql      NID columns + payment_methods, with the triggers
                                   that make both write-once / permanent
server/src/profileUtils.js         NID validation, masking, payment rules (pure)
server/src/profileUtils.test.js    12 unit tests
server/src/routes/profile.js       GET/PATCH profile, POST nid (once), payment methods
server/src/seedProfile.js          demo data (npm run db:seed5)
client/src/pages/Profile.jsx       account, NID, payment methods, activity
client/src/components/NidForm.jsx  one-time NID capture
client/src/components/PaymentMethods.jsx   add-only list (no delete anywhere)
client/src/components/RenterModal.jsx      F23 renter identity check
```
Also run `npm run db:init` (the profile schema is wired into it) and
`npm run db:seed5` after applying.

**Chunk 5 — the co-authored files (4 files)**

These four carry work from more than one member, so they cannot be assigned to a
single person cleanly. Agree between yourselves who lands them — or split the
patch. Which part belongs to whom:

```
server/src/routes/bookings.js   M2  NID gate on booking creation (F21)
                                M4  GET /:id/renter identity endpoint (F23)
client/src/pages/Bookings.jsx   M4  "Review renter" button + RenterModal wiring (F23)
client/src/pages/Checkout.jsx   M3  Taka in the settlement table
client/src/components/QrModal.jsx  M4  uses the shared modal styles
```

## Before you push

```bash
cd server && npm test        # 48 tests must pass
cd ../client && npm run build
```

## Note on the database

Sprint 5 adds a schema file. After applying any chunk:

```bash
docker compose up -d
cd server && npm run db:init && npm run db:seed && npm run db:seed4 && npm run db:seed5
```

`db:seed5` leaves **rahim@rentalflow.test unverified on purpose**, so the
one-time NID step can be demonstrated live. Karim and the admin are pre-verified.
