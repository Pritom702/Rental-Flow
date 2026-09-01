# Deploying RentalFlow to Vercel

## Why the first deploy returned 404: NOT_FOUND

The repository is a monorepo: the React client lives in `client/`, the Express API
in `server/`. There was **no `package.json`, no `vercel.json` and no build output
directory at the repository root**, so Vercel cloned the repo, found nothing it
recognised as an app, produced an empty deployment, and answered every URL —
including `/` — with `404: NOT_FOUND`.

## What was added to fix it

| File | Purpose |
|---|---|
| `vercel.json` | Build command, output directory (`client/dist`), and the rewrite rules |
| `package.json` (root) | Lets Vercel install and run the build; declares the API's dependencies |
| `api/index.js` | Exports the Express app so Vercel runs it as a serverless function |
| `server/src/app.js` | The Express app **without** `listen()`, shared by local dev and Vercel |
| `server/src/index.js` | Now only calls `app.listen()` for local development |

### The rewrites, and why each is needed

```json
{ "source": "/api/(.*)",            "destination": "/api" }        // API → the function
{ "source": "/uploads/(.*)",        "destination": "/api" }        // images → the function
{ "source": "/((?!api/|uploads/).*)", "destination": "/index.html" } // SPA fallback
```

The third rule is essential for a React Router app. Without it, `/` would work
but **refreshing `/dashboard` or `/browse` would 404**, because no file named
`dashboard` exists on disk. The rule says "any path that is not the API and not
an uploaded file, serve `index.html` and let React Router decide". Vercel checks
real static files first, so `/assets/index-xxxx.js` is still served normally.

## Manual steps you must still do in the Vercel dashboard

The code is ready; these three things cannot be done from the repository.

### 1. Project settings

- **Root Directory:** leave as the repository root (`.`) — *not* `client`.
- Framework preset: **Other**. `vercel.json` supplies the build command.

### 2. Create a hosted database

`docker-compose.yml` runs Postgres on your laptop; Vercel cannot reach it.
Create a free Postgres database (Neon, Supabase, or Railway) and copy its
connection string.

### 3. Environment variables (Settings → Environment Variables)

| Name | Value |
|---|---|
| `DATABASE_URL` | the connection string from step 2 |
| `JWT_SECRET` | any long random string |

`server/src/db.js` enables TLS automatically for any non-localhost host, so the
same code connects to both the Docker database and the hosted one.

### 4. Load the schema and demo data into the hosted database

Run these once from your machine, pointed at the remote database:

```bash
cd server
DATABASE_URL="<your hosted connection string>" node src/initDb.js
DATABASE_URL="<your hosted connection string>" node src/seed.js
DATABASE_URL="<your hosted connection string>" node src/seedSprint4.js
```

Then redeploy and check `https://<your-app>.vercel.app/api/health` — it should
answer `{"ok":true,"db":"connected"}`.

## Known limitation: image uploads

`server/src/routes/uploads.js` uses multer to write files to disk. A serverless
function has an **ephemeral, read-only filesystem** (only `/tmp` is writable,
and it is wiped between invocations), so **product photo uploads will not
persist on Vercel**. Everything else — auth, listings, bookings, QR codes,
check-in/out, analytics, documents, maintenance, admin — works normally.

Fixing this properly means moving to object storage (Vercel Blob, Cloudinary or
S3) and saving the returned URL instead of a local path. For the demo, either
run the app locally where uploads do work, or seed the images beforehand.
