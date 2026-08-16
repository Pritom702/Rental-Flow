<!-- Sprint 1 | Owner: M4 - Radowanul Haque (Radowan) | GitHub: @___ | Part: Project documentation -->
# RentalFlow — Peer-to-Peer Equipment Rental Marketplace

A marketplace where **members list their own equipment for rent and rent from
other members** (camera gear, tools, event equipment, etc.). An **admin**
oversees all listings and users.

**Roles:** `admin` (platform owner) · `member` (lists items **and** rents others').

**Stack:** React (Vite) · Node.js + Express · PostgreSQL with **raw SQL** (no ORM) · JWT auth

> Course note: this project uses **hand-written SQL only** — no ORM anywhere.
> Every database call lives in `server/src/routes/*.js` and `server/src/*.sql`.

---

## Team

| Name | ID | GitHub |
|------|----|--------|
| Md. Safinuzzaman | 22301419 | shaafin01 |
| Tawheed Bin Hamid | 22301476 | pritom702 |
| Promit Ghosh Turjo | 22301425 | _add username_ |
| Radowanul Haque | 24101686 | _add username_ |

---

## Prerequisites

- **Node.js 18+** (tested on Node 24)
- **Docker Desktop** (used to run PostgreSQL — no manual Postgres install needed)

---

## Quick start (first time)

From the project root:

```bash
# 1. Start PostgreSQL in Docker
docker compose up -d

# 2. Backend: install, create tables, seed demo data, run API
cd server
npm install
cp .env.example .env        # (Windows PowerShell: copy .env.example .env)
npm run db:init             # creates all tables from schema.sql
npm run db:seed             # inserts demo users, categories, items
npm start                   # API on http://localhost:4000

# 3. Frontend (in a second terminal)
cd client
npm install
npm run dev                 # app on http://localhost:5173
```

Open **http://localhost:5173**.

### Demo accounts (created by the seed)

| Role | Email | Password |
|------|-------|----------|
| Member | rahim@rentalflow.test | member123 |
| Member | karim@rentalflow.test | member123 |
| Admin | admin@rentalflow.test | admin123 |

---

## Sprint 1 — what's implemented

Sprint 1 scope from the proposal: *project setup, database design, item catalog,
categories, item status, and customer/staff basic pages.*

| # | Feature | Where |
|---|---------|-------|
| — | Project setup (React + Express + Postgres, raw SQL) | whole repo |
| — | Database design (items owned by members) | `server/src/schema.sql` |
| 1 | **Item catalog** (multi-image upload from device, description, serial, rental price, replacement cost) | `routes/items.js`, `routes/uploads.js`, `pages/ItemForm.jsx` |
| 2 | **Categorization & tagging** (searchable) | `routes/categories.js`, `routes/items.js` |
| 3 | **Item status tracking** (Available / Rented / Damaged / Under Maintenance / Retired) | `PATCH /items/:id/status` |
| 5 | **Accessory tracking** (accessories linked to a main item) | `accessories` table, `ItemForm.jsx` |
| — | **Member dashboard** (my listings) + **admin oversight** + **public marketplace** | `pages/Dashboard.jsx`, `pages/PublicBooking.jsx` |
| — | Login / signup as **Member or Admin** (not counted as a feature) | `routes/auth.js`, `pages/Login.jsx` |
| — | **Ownership rules**: only a listing's owner (or admin) can edit/delete it | `routes/items.js` (`requireOwnerOrAdmin`) |

> Feature 4 (QR/barcode) is intentionally left for **Sprint 3** per the proposal's sprint plan.

---

## Project structure

```
RentalFlow/
├── docker-compose.yml      # PostgreSQL service
├── server/                 # Express API (raw SQL)
│   ├── src/
│   │   ├── index.js        # app entry
│   │   ├── db.js           # pg pool + query() helper
│   │   ├── schema.sql      # all tables
│   │   ├── initDb.js       # runs schema.sql
│   │   ├── seed.js         # demo data
│   │   ├── middleware/auth.js
│   │   └── routes/         # auth.js, items.js, categories.js
│   └── .env.example
└── client/                 # React + Vite
    └── src/
        ├── App.jsx, main.jsx, api.js, auth.jsx, components.jsx
        ├── icons.jsx       # original inline SVG icon set
        ├── styles.css      # design system (purple+green, light+dark, Lexend/Source Sans)
        └── pages/          # Landing, PublicBooking (Browse), Login, Dashboard, ItemForm
```

Routes: `/` landing · `/browse` marketplace · `/login` · `/dashboard` (member/admin) ·
`/items/new` · `/items/:id/edit`. UI is responsive (375/768/1024/1440) with light + dark themes.

---

## API reference (Sprint 1)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/health` | — | Health + DB check |
| POST | `/api/auth/signup` | — | Register as member or admin |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/items` | — | List items (`?search=&category_id=&status=&tag=&owner_id=`) |
| GET | `/api/items/:id` | — | Item detail (owner, tags, accessories) |
| POST | `/api/uploads` | any user | Upload product image(s) from device (field `images`, up to 8) |
| POST | `/api/items` | any user | List an item (owner = you) |
| PUT | `/api/items/:id` | owner/admin | Update listing |
| PATCH | `/api/items/:id/status` | owner/admin | Change status only |
| DELETE | `/api/items/:id` | owner/admin | Delete listing |
| GET | `/api/categories` | — | List categories + counts |
| POST | `/api/categories` | any user | Create category |
| DELETE | `/api/categories/:id` | admin | Delete category |

---

## Sprint 3 — Checkout lifecycle

Sprint 3 turns the booking engine into a full rental checkout lifecycle:
*approve → agreement → check-out (+ condition report) → check-in (+ condition
report) → damage penalty → deposit reconciliation → PDF.*

| # | Feature | Where |
|---|---------|-------|
| 4 | **QR code generation** (unique `qr_token` per item) | `routes/items.js`, `components/QrModal.jsx` |
| 12 | **QR check-out / check-in** (scan with a phone camera) | `routes/scan.js`, `pages/Scan.jsx`, `pages/Checkout.jsx` |
| 13 | **Condition report** (checkout + checkin, photos, notes) | `condition_reports` table, `routes/bookings.js` |
| 14 | **Damage control & penalty** (severity + repair + missing, capped) | `bookingUtils.js` (`calculatePenalty`), `POST /bookings/:id/checkin` |
| 11 | **Digital rental agreement** | `POST /bookings/:id/agreement`, `pdf.js` |
| 15 | **PDF export** (agreement + return summary) | `client/src/pdf.js` (jsPDF) |

Penalty = `severity% × replacement_cost + repair_cost + missing_charge` (capped at
replacement cost). Severity: Good/New 0 · Fair 5% · Poor 15% · Damaged 30%.
Deposit is reconciled against late fee + penalty (refund vs balance due).

Backend calc logic has unit tests: `cd server && npm test`.

### Scanning from a phone

The item QR encodes `<app-origin>/scan/<token>`, so a phone's **native camera**
opens the check-out/check-in page directly — no scanner app needed.

1. Make sure your phone and PC are on the **same Wi-Fi**.
2. `npm run dev` now exposes the app on the LAN (Vite `--host`). Open it on your
   PC using the **Network** URL it prints (e.g. `http://192.168.x.x:5173`).
3. Open an item's **QR** (Dashboard → item → QR) and scan it with the phone camera.

## Everyday commands

```bash
docker compose up -d      # start database
docker compose down       # stop database (data persists in a volume)
npm run db:init           # (server/) rebuild tables — WARNING: drops existing
npm run db:seed           # (server/) reload demo data
```
