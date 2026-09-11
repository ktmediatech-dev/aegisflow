# AegisFlow Server — Multi-Tenant ERP Backend

Schema-per-company architecture: every subscribed company gets its own
Postgres **schema** inside one shared database. There is no shared table
of business data anywhere — a bug or bad query in one company's session
can never touch another company's rows, because that connection's session
`search_path` only ever resolves to one company's schema.

(Originally this was one fully separate *physical database* per company.
Changed to schema-per-company because most managed/shared Postgres
hosting — including where this is actually deployed — doesn't grant
`CREATE DATABASE` to the app's database user, only `CREATE SCHEMA` within
a database it already owns. See the Development Log below for the full
story and how this was verified.)

## How it fits together

```
Shared database (PG_DB_NAME)
 ├─ public schema (platform metadata)
 │   ├─ companies        (name, schema_name, plan, status)
 │   ├─ platform_admins  (you)
 │   └─ directory        (email -> company_id)   <- routing table only
 │
 ├─ co_petronet_corp_xyz schema (Company #1)
 │   ├─ roles, permissions, users, audit_log
 │   └─ stations, fleet_vehicles, tank_readings, ... (module tables)
 │
 └─ co_shell_uganda_abc schema (Company #2)
     ├─ roles, permissions, users, audit_log
     └─ ... same schema shape, fully separate tables
```

Each company's connection pool (`getTenantPool` in `src/db/tenantDb.js`)
pins its Postgres session `search_path` to just that company's schema at
connect time — every query in every route file uses unqualified table
names (`SELECT * FROM stations`, never `co_x.stations`), so a session
literally cannot resolve another company's tables.

## One-time setup

1. Create the shared Postgres database once (via your hosting panel, or
   `createdb aegisflow` locally) — nothing here creates it for you, only
   your database user's own schemas within it.
2. `cp .env.example .env` and fill in `PG_DB_NAME` plus your app database
   user's credentials. That user just needs ordinary ownership of its own
   database (which grants `CREATE SCHEMA` within it) — no superuser or
   `CREATE DATABASE` privilege required.
3. `npm install`
4. `npm run migrate:platform` — runs the platform schema migration
   (companies, platform_admins, directory) against the `public` schema.
5. `npm run seed:admin` — creates your platform admin login from the
   `BOOTSTRAP_ADMIN_*` values in `.env`.
5. `npm run dev`

## Day-to-day flow

**Adding a new subscribing company (you, as platform admin):**

```
POST /companies
Authorization: Bearer <your platform admin token>
{
  "name": "PetroNet Corp",
  "plan": "annual",
  "itAdminEmail": "it@petronet.com",
  "itAdminName": "Jane IT",
  "itAdminPassword": "temporaryPassword123"
}
```

This single call: creates a new Postgres schema for PetroNet Corp inside
the shared database, runs the tenant migrations into it, seeds all the
default roles (IT Admin, Finance Manager, Fleet Manager, HR Manager,
etc.) with sensible default permissions, creates PetroNet's first user
(their IT Admin), and registers that email in the platform directory
so they can log in.

**IT Admin then logs in and manages their own company:**

```
POST /auth/login            { email, password }       -> JWT
GET  /users                 (list users in MY company)
POST /users                 (add a new employee + assign a role)
GET  /roles                 (see all roles + permission matrices)
POST /roles                 (create a custom role, e.g. "Regional Auditor")
PATCH /roles/:id/permissions (adjust what a role can see/do per module)
```

Every one of these routes pulls `dbName` straight out of the caller's
JWT (set at login time from the directory lookup — it holds a schema
name now, not a database name, kept as "dbName" to avoid renaming it
across every route file; see `tenantDb.js`) — there's no `companyId`
parameter a client could tamper with to see another company's data,
because the connection pool's session is scoped to exactly one schema.

## Adding a new module (e.g. HR)

1. Add a migration file under `src/db/migrations/tenant/` with the new
   tables (e.g. `hr_employees`), numbered after the existing ones
   (`003_...sql`). New companies pick it up automatically at provisioning
   time; for companies that already exist, run `npm run migrate:tenants`
   to apply it everywhere (safe to re-run — every migration uses
   `CREATE TABLE/INDEX IF NOT EXISTS`).
2. Add routes under `src/routes/hr.routes.js`, gated with
   `requirePermission('hr', 'write')` etc.
3. The module already exists in the permission system
   (`src/config/modules.js`) and every company's roles already have a
   row for it, defaulted to no access except where seeded.

## Security notes for production

- Schema-level isolation relies entirely on every query going through
  `getTenantPool()`'s session-pinned `search_path` and never explicitly
  qualifying a table with another schema's name — audit any new raw SQL
  for that. A leaked `PG_APP_USER` credential can reach every company's
  schema (same tradeoff database-per-tenant would have had with a shared
  admin credential; a compromised app-level credential was never
  contained by either design).
- Put the admin-only `/companies` routes behind an extra layer (IP
  allowlist, 2FA) since they can create/suspend any company.
- Rotate `JWT_SECRET` and keep `.env` out of version control.

---

## Development Log

Chronological record of what's been built, so context isn't lost between
sessions. Newest entries at the top.

### 2026-09-11 — Platform-admin hardening (external review follow-up)

An external code review flagged four things. Three were still valid,
one was stale — worth recording which was which:

1. **`autosync` script risk** — checked first rather than assumed: the
   full git history (5 commits, this session only) has no leaked
   secrets; `.env` was excluded from commit 1. Still removed the
   `npm run autosync` one-liner (`git add . && commit && push`, risky
   to ever run unattended) and deleted `scripts/autosync.js` — a
   separate, already-dead watcher script that targeted a `main` branch
   this repo doesn't have (it's `master`), so it would've failed if
   anyone tried it.
2. **Admin route protection** — real gap, now addressed: `/companies`
   (create/suspend/plan-change/password-reset on *any* company) had
   nothing beyond "has a valid JWT". Added a stricter rate limiter
   scoped to just this router, an optional IP allowlist
   (`PLATFORM_ADMIN_IP_ALLOWLIST` — off by default), and a new
   platform-wide audit log (`platform_audit_log` table, surfaced in the
   Companies page) recording who did what to which company and from
   what IP. Verified against real Postgres — a plan change correctly
   logged with the real client IP through Webuzo's proxy, confirming
   `trust proxy` resolves it accurately (so the allowlist will too, once
   enabled). Full TOTP 2FA was deliberately deferred — it's a bigger,
   separate change (adds a second login step to the platform-admin flow)
   rather than a drop-in hardening measure; flag if you want it built.
3. **Shared `PG_APP_USER` across all tenant schemas** — still an open
   gap, not addressed this pass. One leaked credential currently reaches
   every company's schema. Not urgent for a single-pilot-customer stage;
   revisit (per-tenant DB roles, or Postgres row-level security as
   defense-in-depth) before onboarding unrelated companies.
4. **"Untested against real Postgres"** — this was stale by the time
   the review reached me; every feature since the schema-per-company
   migration earlier today has been built and verified against the live
   `scholars_aegisflow` database, not just the dev fallback.

### 2026-09-11 — Git, truck compartments/offload UI, org settings & themes

**GitHub**: initial commit made locally, then pushed to
`git@github.com:ktmediatech-dev/aegisflow.git` once the `Kasuleronald`
account was added as a collaborator and accepted the invite. All work
from this point on is committed and pushed there — check it first for
the latest state rather than assuming the deployed server always has it
(the server gets updated by direct file upload during a session, same
as always; git isn't wired into the deploy path itself yet — see "Still
open" below).

**Truck compartments + depot-to-station offload — frontend, and the full
arrival/tank-assignment extension to the backend.** Building on the
compartment/dip-reading backend from earlier: Fleet page now has
owned/hired vehicle fields and a per-vehicle compartment registration
modal; Tanks page has trip creation and a `TripManagerModal` that walks
a trip through loading → in-transit → arrived → completed, matching
what the UI actually lets you do at each stage. Extended the backend
(and the trip lifecycle) further per a detailed workflow spec: departure
time is captured automatically when loading dips are submitted; arrival
must be explicitly recorded by the station manager (a separate step,
gates delivery dipping — verified this rejects delivery entry before
arrival); receiving tanks get an opening dip captured before offload;
each compartment is assigned to exactly one tank (confirmed: no
splitting a compartment across tanks) and the product must match — PMS
only into a PMS tank, AGO only into AGO, BIK only into BIK, verified via
a real rejected mismatch; the system computes an expected closing volume
per tank (opening + delivered − any pump sales on that tank during the
offload window, sourced from the existing nozzle_readings mechanism)
for later comparison against that tank's next physical dip. All of this
was tested against real Postgres end-to-end (create trip → load → block
premature delivery → arrive → capture opening dip → reject
product-mismatch → deliver correctly → verify expected-closing math),
not just written and assumed correct.
*Known gap:* this specific feature (schema 006, the arrival/offload
extension) was not backfilled into `devFallback.js` — it only works
against real Postgres. Everything through schema 005 (compartments,
basic trip loading/delivery) does have fallback support.

**Organization Settings**: new self-service page (IT Admin only) for a
company's own branding — logo (small image, stored inline as a data
URI; there's no file-storage service configured, so keep logos under
~350KB), display name, and contact email. The logo + name now render in
the header for everyone in that company. Also replaced the old binary
dark/light toggle with **7 selectable theme presets** (dark, light,
ocean, forest, sunset, slate, violet) — the IT Admin sets the company's
default, but it only takes effect for browsers that have never had a
user explicitly pick their own theme (tracked separately), so it never
silently overrides someone's personal choice.

**Also fixed while in the area:**
- `api.js`'s error handler had a real bug: `throw new Error(...)` inside
  a `try` block was being caught by its own adjacent `catch`, discarding
  the backend's actual error message (e.g. "This company account is not
  active") in favor of a generic HTTP status text ("Unauthorized" for
  everything). This is why a real 401 was showing as "Unable to sign in"
  instead of the specific reason — fixed, and specific reasons now
  surface correctly (verified: suspended-company and disabled-user cases
  already had specific backend messages, they just weren't reaching the UI).
- `express-rate-limit` was warning on every request behind Webuzo's
  reverse proxy (`X-Forwarded-For` present but Express `trust proxy` not
  set) — added `app.set('trust proxy', 1)`.
- Plans simplified to just `trial` and `enterprise` per direction — the
  `starter`/`growth` options were placeholders with no different
  behavior behind them anyway (see the "plans have no functional
  difference yet" note below, still true).

**Still open / worth knowing:**
- **Plan tiers still don't do anything.** `trial` vs `enterprise` is a
  label on the company record — nothing gates a feature, limits usage,
  or drives billing based on it. If that needs to become real, that's a
  distinct feature (module limits per tier, user/station caps, or a
  billing provider integration) — flag when ready.
- **Git and the live deploy are two separate, manually-synced things.**
  A `git push` does not touch `aegisflow.scholarsas.com` — deploying
  still means re-running the tar/scp steps documented lower in this log.
  Worth setting up a proper deploy hook (e.g. a GitHub Action that SSHes
  in and pulls) if deploys are going to keep happening this often.
- SSH to `nexus.crystalcloudhost.com` continues to be intermittently
  flaky (random mid-command disconnects) — a recurring nuisance, not a
  sign of misconfiguration; just retry.

### 2026-09-11 — Platform admin/tenant separation, deployment bug fixes

**Platform admin was seeing (empty) tenant UI — fixed.** Login granted
platform admins full `can_read/write/approve` on every company module
(a hack so the shared route guards wouldn't block them from the
Companies page), so they saw the entire company sidebar — Stations,
Fleet, Tanks, HR, Finance, etc. — just always empty, since a platform
admin has no tenant schema to fetch from. Per explicit correction: a
platform admin manages companies (onboard, suspend/activate, change
plan, reset a locked-out user's password, view their audit log) and
never touches tenant operational data. Fixed properly:
- `useStore.js` login: platform admins now get `permissions: []`
  instead of blanket access — the existing sidebar filter logic then
  naturally reduces to just the "Platform" group with no special-casing needed.
- `ProtectedRoute.jsx`: a platform admin hitting any company-scoped
  route (`moduleKey` set, not `platformOnly`) is redirected to
  `/companies` instead of falling through to a page-level permission
  check that would've denied them anyway.
- `App.jsx`: the root `/` redirect now goes to `/companies` for platform
  admins, `/dashboard` for everyone else (was hardcoded to `/dashboard`).
- New platform-admin capabilities requested and built: `PATCH
  /companies/:id/plan` (subscription changes), `GET /companies/:id/users`
  + `POST /companies/:id/users/:userId/reset-password` (support/lockout
  recovery — bypasses the company's own auth entirely, by design), `GET
  /companies/:id/audit-log` (per-company `audit_log` table, previously
  written to but never exposed anywhere). `Companies.jsx` rewritten with
  an expandable per-company panel for all of this. Also fixed a bug where
  the page called `api.createCompany` — a method that never existed
  (only `provisionCompany` did) — so company creation from this page was
  silently broken before this pass.
- Found and fixed a real bug along the way: `Contractors` was gated on
  the `hr` module in `Sidebar.jsx` but `maintenance` in `App.jsx`'s
  actual route guard — a leftover mismatch from the Batch 2 module-gate
  fix that never got applied to the sidebar's copy of the same check.

**Deployment mechanics learned the hard way:**
- Webuzo's "Self Managed" Node app type needs **both** a Start Command
  and a Stop Command, or Create refuses to save — even though the
  startup-file field looks like it should be enough on its own.
- The Stop Command field doesn't handle quotes/backslashes well; a
  `pkill -f "some quoted path"` gets silently mangled on save. Use an
  unquoted path instead (fine as long as the path has no spaces):
  `pkill -f public_html/aegisflow/src/index.js`.
- **`pkill -f <substring>` only matches if the substring is contiguous
  in the process's actual command line.** Webuzo launches the app as
  `cd /path && export ... && node src/index.js`, so a pattern like
  `public_html/aegisflow/src/index.js` never matches (the real cmdline
  has that path split across a `cd` and a separate `node src/index.js`)
  — `pkill` silently did nothing, hard to notice, and the OLD process
  kept serving stale code through what looked like successful restarts.
  When in doubt, `ps aux | grep node` and kill the exact PID.
- A code change to backend route files needs a process restart to take
  effect (no hot reload) — updating `dist/` alone (frontend) doesn't.
  Webuzo does auto-restart a killed app eventually, but it's not
  instant; don't assume a route is live until you've actually tested it.
- The SQL shell-escaping trap: passing a bcrypt hash (which contains
  `$`) through nested `ssh '...' "psql -c \"...\""` quoting silently
  mangles the `$` sequences — a password reset appeared to succeed but
  the stored hash was corrupted. Fixed by writing the SQL to a local
  file and running `psql -f file.sql` instead of inlining it — avoids
  shell interpolation entirely. Use this pattern for any future
  hash/secret that has to reach the database through this SSH path.
- Generated passwords should avoid visually ambiguous characters
  (`l`/`I`/`1`, `O`/`0`) — a first-round admin password using them
  caused a real failed-login-loop when read off a chat transcript.

### 2026-09-11 — First real deployment: schema-per-company migration + Webuzo

**The database-per-company model didn't survive contact with real
hosting.** Connected via SSH to the target box (`nexus.crystalcloudhost.com`,
user `scholars`) and checked the Postgres user Webuzo had provisioned
(`scholars_kasule`, owner of `scholars_aegisflow`): `rolcreatedb = false`,
not superuser. `CREATE DATABASE` — the operation the entire "true
separate database per company" pitch was built on — was never going to
work here, and this is typical of managed/shared Postgres in general, not
a quirk of this one host. Verified the alternative before committing to
it: that same non-superuser user CAN `CREATE SCHEMA` and `CREATE
EXTENSION pgcrypto` inside its own database. So: switched the entire
multi-tenancy model from **database-per-company to schema-per-company**,
all within one shared `PG_DB_NAME` database.

**What changed:**
- `tenantDb.js` — pools now connect to the one shared database, with
  `options: -c search_path="<schema>",public` pinning each pool's session
  to one company's tables. This is *why* isolation still holds: nothing
  in the codebase ever qualifies a table name with a schema prefix, so a
  session literally cannot see another company's rows even if a bug tried.
- `provisioning.js` — `createPhysicalDatabase()` (CREATE DATABASE) became
  `createTenantSchema()` (CREATE SCHEMA), using the ordinary app
  credential instead of a separate admin one.
- `platformDb.js`, `migratePlatform.js` — no more separate admin
  connection to create the platform database; platform tables now live in
  the shared database's `public` schema, connected with the same
  app-level credential.
- `migrateTenants.js` — rewritten to loop companies and `SET search_path`
  per company on one shared connection, instead of opening a separate
  `Pool` per company database.
- `companies` table: `db_name` column renamed to `schema_name` (edited
  directly in `001_init.sql` rather than adding a migration — safe since
  this was the first real deployment, no companies existed yet anywhere).
- **Deliberately did NOT rename** the `dbName` field carried in the JWT
  and read via `req.auth.dbName` in every route file — renaming that
  would have touched ~15 files for a cosmetic win. It now holds a schema
  name; there's a comment at each of the two or three places that would
  confuse a reader (`auth.routes.js`, `tenantDb.js`).
- `.env` restructured: `PG_ADMIN_*` variables removed entirely (no admin
  connection needed anymore), `PLATFORM_DB_NAME` merged into a single
  `PG_DB_NAME` (platform and every tenant now share one physical database).
- **Verified for real, not just built:** SSH'd in, ran the platform
  migration and admin seed against actual Postgres, logged in as platform
  admin, provisioned a real throwaway company via `POST /companies`,
  confirmed its schema got all 20 tables from all 4 tenant migrations,
  logged in as that company's IT Admin, created a station, confirmed
  `GET /stations` only ever returned that company's own row — then tore
  the test company down (`DROP SCHEMA ... CASCADE`) so the deployment
  starts clean. This is the first time any of this session's work has
  touched real Postgres rather than the dev fallback.

**Deployment prep (also needed regardless of the schema change):**
- `src/index.js` — all API routes moved under `/api/*` (was root-mounted),
  and the Express server now also serves the built frontend (`dist/`,
  static + SPA fallback to `index.html` for any non-`/api` route). Needed
  because Webuzo's Node app manager runs one process per app/subdomain
  and reverse-proxies the whole thing to it — there's no separate static
  file server for the frontend, so the same Node process has to do both.
- `vite.config.js` — `base: '/aegisflow/'` → `base: '/'` (the subdomain
  `aegisflow.scholarsas.com` maps directly to this app's document root,
  it's not served from a sub-path — the old base would have made every
  built asset URL 404) — and the dev proxy no longer strips `/api` since
  the backend now natively serves under that prefix.

**Deployed to:** `aegisflow.scholarsas.com` → `/home/scholars/public_html/aegisflow`
on `nexus.crystalcloudhost.com`, database `scholars_aegisflow`, running on
port `30006` (30001–30005 were already taken by other apps/accounts on
this shared box — check with `ss -tln` before picking a port for a future
redeploy). Platform admin: `ktmediatech1@gmail.com` (password generated
this session — rotate it after first login; it's in the server's `.env`,
not repeated here).

**Known rough edges from this deployment pass:**
- `node_modules` was uploaded as a tarball built on this Windows dev
  machine rather than `npm install`'d on the server — the server's
  outbound connection to `registry.npmjs.org` was timing out
  intermittently (`ETIMEDOUT`/`EHOSTUNREACH`), which is a hosting-network
  issue, not an npm or dependency problem. Every dependency here is pure
  JS (no native bindings), so this is safe, but if a future dependency
  needs native compilation, this shortcut won't work and the network
  issue will need to be resolved with the host.
- The Node app is **not yet running under Webuzo's Node App Manager** —
  it was started manually (`node src/index.js`, backgrounded over SSH) to
  verify everything works, then stopped again. Creating the actual
  Webuzo app entry (name `aegisflow`, path
  `/home/scholars/public_html/aegisflow`, port `30006`, startup file
  `src/index.js`) and enabling it is the next step — Webuzo will restart
  it on crash/reboot, which the manual `nohup` invocation won't.
- The SSH connection to this host was noticeably flaky throughout (random
  `Connection reset by peer` / `kex_exchange_identification` failures on
  otherwise-idle connections) — if a future session hits the same thing,
  it's the network, not a sign anything is misconfigured; just retry.

### 2026-09-11 — Per-station users, maker-checker deletions, nozzle/tank throughput tracking

**Per-station user scoping.** `users.station_id` (a column that existed in
the original schema but was never wired up) is now a real FK to
`stations`. Set it when creating a user (Users page → Add User → Station
dropdown) to scope that user to one station's data instead of the whole
company. It flows: `users.station_id` → resolved to `stationId`/`stationName`
at login → carried in the JWT → filtered in JS after each query in
`stations.routes.js`, `fleet.routes.js`, `tanks.routes.js` (readings only),
and `maintenance.routes.js` (see `src/utils/stationScope.js`). Filtering
happens in JS rather than SQL specifically so the dev fallback and real
Postgres behave identically. **Not scoped:** transit logs (they're
route/vehicle-based, not tied to one station by nature) and Analytics/
Reports (network-wide by design). Tested end-to-end: a Station-Manager
role user assigned to "Nairobi Central" only sees that station via
`/stations` and `/fleet`.

**Maker-checker deletions.** Interpreting "deletions must be upon request
and approved by another user appointed by the admin": rather than
building a new "approver" role concept, deletion approval reuses the
*existing* per-module `can_approve` permission (the same flag that
already gates, e.g., compliance-case approval). `DELETE` on Stations,
Fleet, Contractors, and Suppliers no longer removes the row — it inserts
a row into `deletion_requests` (status `pending`) and returns `202`. A
second user who holds `can_approve` on that module — and is **not** the
original requester (enforced server-side, not just hidden in the UI) —
approves or rejects it from the new **Deletion Requests** page
(`/deletion-requests`, sidebar under People & Admin). Approving actually
deletes the row; rejecting just closes the request. See
`src/services/deletionRequests.js` and `src/routes/deletionRequests.routes.js`.
Verified: self-approval attempts return 403; a second admin's approval
deletes the record.
*Not yet request-gated:* Maintenance jobs, HR/Finance/Procurement/
Compliance records have no delete endpoints at all yet (they never did) —
extend `DELETABLE_MODULES` in `deletionRequests.js` and copy the pattern
from `stations.routes.js`'s DELETE handler if/when those need it.

**Nozzle / tank-throughput tracking.** New tables: `tanks` (a persistent
tank entity — distinct from `tank_readings`, which are periodic snapshots
from before this existed), `nozzles` (each belongs to one tank; several
nozzles can share a tank), `nozzle_readings` (opening/closing pump-meter
values per date; throughput = closing − opening, computed on read, never
stored). New "Nozzles & Meters" tab on the Tanks page: add a nozzle
(auto-registers its tank if new), record a meter reading, and a
**reconciliation view** that cross-checks each tank's recorded
`sales_volume` against the summed throughput of its nozzles for the same
date — flags anything over 2% variance, the same kind of signal
Fraud Detection already looks for on transit loss. API: `GET/POST
/nozzles/tanks`, `GET/POST /nozzles`, `GET/POST /nozzles/readings`, `GET
/nozzles/reconciliation`.
**Interpretation flag:** the user's instruction mentioned tracking
"pump meters and RTT" — this was built as meter-reading *timestamps*
(opening/closing meter values recorded per date), which is the standard
way stations track nozzle throughput. If "RTT" meant something more
specific (e.g. tanker round-trip time — that's already covered
separately by `transit_logs`), flag it and this can be adjusted.
**Known gap:** reconciliation only compares rows where a tank_reading and
nozzle readings exist for the *exact same date* — there's no rollup
across a date range yet, and no UI to browse historical trends. The
`tanks` (master) count on a Station and its own `tanks: INT` field on the
`stations` table are two different, currently-unreconciled things: one is
just a headcount for the station card, the other is the new proper tank
registry.

**Bug fixes found while testing this batch (all fixed and re-verified):**
- The dev-fallback in-memory DB was returning `password_hash` in the
  response body of `POST /users` and `PATCH /users/:id` — a real
  credential leak in dev mode (real Postgres never had this bug, since it
  only ever returns the columns named in `RETURNING`). Fixed in
  `devFallback.js` to mirror the same field allowlist.
- `Stations`, `Fleet`, `Suppliers`, `Contractors` DELETE flows needed the
  dev fallback to support `SELECT ... WHERE id = $1` (previously the
  fallback ignored WHERE clauses entirely and returned every row) — fixed
  generically for those four tables.

### 2026-09-10 — Batches 2 & 3: Contractors, Suppliers, Alerts, Analytics/Reports

Extended the same real-backend pattern from HR/Finance/Procurement/
Compliance (and the fleet-ops batch below) to the remaining modules that
were still pure frontend mock data:

- **Contractors** (`contractors` table) — gated on the `maintenance`
  permission, since there's no dedicated `MODULE_KEYS` entry for them and
  they're hired for maintenance work.
- **Suppliers** (`suppliers` table) — gated on `suppliers`.
- **Alerts** (`alerts` table) — gated on `dashboard` (matches the existing
  frontend route gate). Acknowledge/dismiss are now real `PATCH` calls,
  not local-only state changes.
- **Analytics / Reports / Fraud Detection charts** — previously entirely
  fabricated (`mockChartData`), now computed from real rows via `GET
  /analytics/overview`: tank variance (from live `tank_readings`),
  transit-loss trend and maintenance-cost trend (both bucketed into the
  trailing 6 calendar months from `transit_logs`/`maintenance_jobs`), and
  station performance (real `monthlySales`, plus an optional
  `salesTarget` field added to Stations — see below).
- **Honesty call:** there is no sales-transaction ledger (stations only
  store one rolled-up `monthlySales` number), so a genuine month-by-month
  "revenue by fuel type" trend isn't derivable yet. Rather than fabricate
  one, that chart was replaced with a real "Monthly Sales by Station" bar
  chart. A proper trend would need a new sales-history/POS-integration
  module — flag if you want that built next.
- Added `stations.sales_target` (nullable) so Analytics can show real
  efficiency (`sales / target`) instead of an invented benchmark. Set it
  from the Stations page's Add/Edit form.
- Fixed a routing bug: the Contractors page was gated on the `hr` module
  permission in `App.jsx` (a placeholder that never matched the module's
  actual purpose) — changed to `maintenance` to match the new backend gate.

### 2026-09-10 — Batch 1: Stations, Fleet, Tanks, Maintenance (the core fuel-ops loop)

These four modules — the actual fuel/fleet-distribution business logic
that makes this product what it is — had **zero backend**: no DB tables,
no routes, no permission checks. Everything came from `src/data/mockData.js`.
Built out the same tenant-scoped, permission-gated pattern the
pre-existing HR/Finance/Procurement/Compliance routes already used:

- New tables (`002_fleet_ops.sql`): `stations`, `fleet_vehicles`,
  `tank_readings`, `maintenance_jobs`, `transit_logs`.
- New routes: `stations.routes.js`, `fleet.routes.js`, `tanks.routes.js`,
  `maintenance.routes.js`.
- `provisioning.js` now concatenates and runs *every* numbered file under
  `migrations/tenant/`, not just `001_init.sql` — new modules just need a
  new numbered `.sql` file.
- Added the tenant migration runner the original README flagged as
  missing: `npm run migrate:tenants` re-applies every tenant migration to
  every already-provisioned company (safe to re-run — everything uses
  `IF NOT EXISTS`).
- `devFallback.js` (the in-memory dev DB used when Postgres isn't
  configured) extended with real query handling + seed data for all five
  new tables, so local dev keeps working without installing Postgres.
- **Found and fixed a real bug:** the Stations, Fleet, and Maintenance
  pages called `addStation`/`updateStation`/`deleteStation`/
  `addFleetVehicle`/etc. — none of these existed in the Zustand store.
  The Add/Edit/Delete buttons on those pages were silently doing nothing
  before this. Implemented all of them in `useStore.js`.
- **Found and fixed another bug:** `fetchCompanyData()` (which loads all
  tenant data) was only ever called once, right after login — a page
  refresh while already logged in showed nothing. `Layout.jsx` now also
  calls it on mount.
- Moved `zz users.txt` (plaintext demo credentials) into the gitignored
  `seed-data/` folder.

### Still mock / not yet built
- Nothing left in `mockData.js` except Users/Roles/HR/Finance/
  Procurement/Compliance's *fallback* defaults (used only if an API call
  fails — the primary path is always the real backend).
- DataImport page (`src/pages/DataImport.jsx`) hasn't been touched — CSV
  import still needs backend wiring if that's wanted next.
- Deletion requests only exist for Stations/Fleet/Contractors/Suppliers
  (see above).

### Deploying to Webuzo (in progress)
Target: subdomain `aegisflow.scholarsas.com` →
`/home/scholars/public_html/aegisflow`, IP `104.194.11.128`, PostgreSQL
managed via Webuzo's "Manage PostgreSQL" panel. Not yet connected —
waiting on SSH access and DB credentials. Everything above has only been
tested against the in-memory dev fallback (`npm run dev` + `npm start`
with no `.env`/unreachable Postgres). Once Webuzo Postgres is reachable:
fill in `.env` from `.env.example`, run `npm run migrate:platform`, then
`npm run seed:admin`, then provision a real company via `POST /companies`
to get a fully-Postgres-backed tenant to test against — the dev-fallback
code paths are never used once a real Postgres connection succeeds
(see `src/db/platformDb.js`).
