# JBOS — Project Context & Handoff (Verified)

> **Verification basis:** this document was rebuilt against the live repo — `git log`, `server/src/database/schema.sql`, every `server/src/routes/*.js`, the client pages/nav, and the working tree. It reflects real shipped state, not prior summaries.
> **Latest commit at write time:** `e66c03f` on `main`.

---

## 1. Project Identity

- **JBOS** = **Jewellery Business Operating System**.
- **Purpose:** a single in-house operating platform for one jewellery business — generate luxury quotations, run live gold pricing + WhatsApp delivery, and manage CRM (leads, customers) and HRMS (employees, attendance, leaves, shifts, tasks, incentives, payroll foundation, HR calendar, document vault) under role-based access.
- **Maturity:** production, deployed and in active use. Started V1 (quotation engine), expanded through milestones M1–M7. Currently consolidating M7 (advanced HRMS) after a fix pack; M8 not started.
- **Tenancy:** **single-tenant.** One business. No tenant column, no per-tenant scoping. Multi-tenant would be a future re-architecture.

---

## 2. Current Verified State

- **Latest commit:** `e66c03f` — `fix(m7): shift reactivation, sales-exec incentives, doc vault URLs, full HR calendar, dashboard RBAC`.
- **Deploy:** Render auto-deploys both services on push to `main`. This commit is pushed (`7918ee3..e66c03f`).

| Milestone | Scope | Status |
|---|---|---|
| V1 | Quotation engine (pricing → luxury template → PDF → history), live gold rates, WhatsApp | ✅ live |
| M1 | JWT auth, single-tenant, auto-bootstrap super_admin | ✅ live |
| M2 | RBAC (3 roles), quote ownership + visibility scoping, user management, audit foundation | ✅ live |
| M3 | Company settings, master data, dynamic dropdowns/pricing, gold-rate override UI | ✅ live |
| M3.5 | Backend-driven history filters/search/sort | ✅ live |
| M4 | CRM Core — leads, pipeline, followups, lead→quote conversion | ✅ live |
| M5 | Advanced CRM — customers, timeline, reminders, conversion, dedupe, analytics | ✅ live |
| M6 | HRMS Core — employees, attendance, leaves, performance KPI | ✅ live |
| M7 | Advanced HRMS — shifts, tasks, incentives, payroll foundation, HR calendar, document vault | ✅ live |
| **M7 Fix Pack** | shift re-activate, sales-exec incentive visibility, doc-vault URL fix, full calendar UX + manual events, dashboard RBAC | ✅ live (`e66c03f`) |
| M8 | Inventory | ⛔ **not started** |

---

## 3. Architecture

```
React (Vite + Tailwind) ──HTTPS──▶ Express API ──▶ Neon PostgreSQL
 jbos-client.onrender.com           jbos-api.onrender.com
                                        ├─▶ Puppeteer (headless Chrome) → A4 quotation PDF
                                        ├─▶ Meta WhatsApp Cloud API (Graph v20) → PDF delivery
                                        └─▶ goldapi.io → live gold spot (+ India markup)
```

- **Frontend:** React 18, React Router 6 (`createBrowserRouter`), Vite 5, Tailwind. Axios singleton with JWT auth header + 401 interceptor. Auth state in React Context (localStorage hydrate). Role-filtered nav.
- **Backend:** Node + Express (ESM). Hand-rolled SQL via `postgres` (porsager/postgres.js) — **no ORM**. Service-per-domain, thin routers, middleware (`requireAuth`, `requireRole`/`requireAdmin`/`requireSuperAdmin`, error handler).
- **Database:** Neon PostgreSQL. Schema + migrations applied idempotently on every boot inside an advisory-locked transaction.
- **Deployment:** Render free tier, two services, auto-deploy on push to `main`. Cold-start ~50s after idle.
- **Storage:** uploaded files (employee docs, quotation product images) → multer disk under `<projectRoot>/uploads`, served by `express.static('/uploads')`. **Ephemeral on Render** (wiped on redeploy). Client resolves stored `/uploads/...` paths against the API origin via `assetUrl()`.
- **PDF:** Puppeteer renders the approved luxury HTML template (A4, viewport 794×1123). `.puppeteerrc.cjs` ships Chrome into the build artifact (Render cache fix). `page.pdf()` Uint8Array wrapped in `Buffer.from()`.
- **WhatsApp:** Meta Cloud API (Graph v20.0). Template send (`quotation_document`) with document header; PDF uploaded via `/media`, message via `/messages`. Status stored on the quotation row.
- **Gold API:** `goldapi.io` (provider modes `mock | goldapi | http`). Optional India retail markup layer (`GOLD_INDIA_MARKUP_PCT`). Daily `node-cron` refresh. Admin manual override (override row wins; DELETE to clear). Frozen snapshot onto each quotation at create time.
- **Authentication:** bcryptjs hashes, JWT (24h, **no refresh token**), `Authorization: Bearer` header (no cookies). No public signup — admin-created users only. Auto-bootstrap of first super_admin from `SEED_ADMIN_*` on empty DB.
- **RBAC:** 3 roles (`super_admin`, `admin`, `sales_executive`). Enforced **server-side** in services (scope helpers); UI hiding is cosmetic.
- **Audit:** `audit_events` table + fire-and-forget `audit.record()` (never throws into request path).

### Folder layout
```
client/src/
  api/client.js        axios + all API bundles + assetUrl() + pdfActions
  auth/                AuthContext, RequireAuth, RequireRole
  components/          Layout (sidebar/nav), GoldRateWidget, SendWhatsAppButton, LeadFormModal
  pages/               Dashboard, CreateQuotation, QuotationHistory, QuotationPreview, Login,
                       Leads, LeadDetail, Customers, CustomerDetail, Employees, EmployeeDetail,
                       Attendance, Leaves, Tasks, Shifts, Incentives, HRCalendar
  pages/admin/         Users, Settings, Masters, GoldRates
  router.jsx, main.jsx, styles/index.css
server/src/
  app.js               express factory + route mounting + /uploads static
  index.js             bootstrap (initDatabase → scheduler → listen)
  database/connection.js  postgres client, schema apply, runMigrations, auto-seeds
  database/schema.sql  full idempotent schema (30 tables)
  middleware/          auth.middleware, roles.middleware, error.middleware
  services/            one per domain
  routes/              one per domain
  utils/               quoteId, leadCode, customerCode, employeeCode, format, validate
  .puppeteerrc.cjs     project-local Chrome cache
templates/quotation.template.html   luxury PDF template with {{placeholders}}
docs/                  PRD, TRD, ARCHITECTURE, Phase2, prcontext (this file)
```

---

## 4. Database

**Verified table count: 30** (all in `server/src/database/schema.sql`, all `CREATE TABLE IF NOT EXISTS`).

| Domain | Tables | Purpose |
|---|---|---|
| Auth / RBAC | `users`, `audit_events` | accounts + immutable activity log |
| Config | `company_settings` (single row), `master_product_categories`, `master_metal_types`, `master_purities`, `master_diamond_types`, `master_cities`, `master_making_presets` | business identity, pricing defaults, dynamic dropdowns |
| Quotation | `quotations` | quotes with frozen pricing snapshot |
| Rates | `gold_rates`, `diamond_rates`, `gemstone_rates`, `making_charges` | rate tables (gold is location-aware + override-capable) |
| CRM | `leads`, `lead_followups`, `lead_sources`, `lead_statuses`, `customers`, `customer_events`, `reminder_tasks` | pipeline, timeline, reminders |
| HRMS | `employees`, `attendance`, `leaves`, `shifts`, `tasks`, `incentives`, `employee_compensation`, `employee_documents`, `calendar_events` | full HR suite |

**Major relations**
- `quotations.owner_user_id → users`, `quotations.source_lead_id → leads`.
- `leads.assigned_user_id → users`, `leads.converted_customer_id → customers`, `leads.converted_quotation_id`, `leads.converted_at`.
- `customers.source_lead_id → leads`; `customers.mobile` UNIQUE (dedupe identity).
- `employees.user_id → users` (UNIQUE, one profile per user), `employees.reporting_manager_id → employees`, `employees.assigned_shift_id → shifts`.
- `attendance.employee_id → employees` (UNIQUE per employee+date), `leaves.employee_id → employees`.
- `incentives.employee_id → employees`; `employee_compensation.employee_id`; `employee_documents.employee_id`.
- `calendar_events.created_by_user_id → users`.

**ID conventions:** quotations `QT-YYYY-NNNN`, leads `LD-YYYY-NNNN`, customers `CUST-YYYY-NNNN`, employees `EMP-YYYY-NNNN`.

**Ownership rules**
- Sales-exec sees only rows they own: quotations (`owner_user_id`), leads/customers/reminders (`assigned_user_id`), tasks (`assigned_to_user_id`), attendance/leaves/incentives (their `employees.id` via `ensureForUser`).
- Sales-exec quote create locks `owner_user_id` to self (server enforces, ignores client-supplied owner).
- Admin/super_admin: unscoped (all rows).

**Indexing strategy**
- Inline `CREATE INDEX IF NOT EXISTS` for columns present at table-create time.
- **Critical rule:** any index on an **ALTER-added** column is created **inside `runMigrations()` after** the ALTER — never inline in `schema.sql` (because `CREATE TABLE IF NOT EXISTS` is skipped on existing DBs, leaving an inline index referencing a not-yet-added column → deploy crash; this caused two past prod crashes). Brand-new tables fully defined in `schema.sql` may keep inline indexes (e.g. `calendar_events`).

**Migration strategy**
- On every boot: advisory lock (`pg_advisory_xact_lock`) → apply `schema.sql` (idempotent) → `runMigrations(tx)` (guarded `ALTER`s via `information_schema` checks) — all in one transaction, safe for multiple replicas.
- Migrations to date: gold_rates (source/updated_at/location/is_override), quotations (pricing_location, whatsapp_*, owner_user_id + backfill, source_lead_id), leads.converted_at, employees.assigned_shift_id, **employees.birthday** (M7 fix pack), deferred indexes for owner/source_lead/gold-rates.

**Seed strategy**
- `autoBootstrapAdmin()` — creates super_admin from `SEED_ADMIN_*` only if users table empty; clears demo quotations once.
- `autoSeedMasters()` — seeds 6 master catalogs + lead sources + lead statuses (with `is_terminal` semantics) only when empty.
- `autoSeedEmployees()` — one employee row per user without one (idempotent, `ON CONFLICT (user_id) DO NOTHING`).

---

## 5. RBAC Matrix (verified against routes + services)

| Capability | super_admin | admin | sales_executive |
|---|---|---|---|
| Quotations create/preview/PDF/WhatsApp | all | all | **own only** |
| Quotation owner assignment | yes | yes | locked to self |
| Leads (CRM) | all | all | own only (no reassign) |
| Customers + reminders | all | all | own only |
| Tasks | all (assign anyone) | all | own + **status-only** update |
| Incentives | create/approve/pay/see all | create/approve/pay/see all | **view own only** (+ self-summary) |
| Compensation (payroll) | yes | yes | **no** |
| Employees directory | yes | yes | **no** |
| Document Vault (upload/view/remove) | yes | yes | **no** |
| Shifts (CRUD + assign + activate/deactivate) | yes | yes | **no** |
| HR Calendar (view + manual event CRUD) | yes | yes | **no** |
| Attendance | mark anyone + edit + org today | mark anyone + edit + org today | **mark self only**, view own, **my-today only** (no org counts) |
| Leaves | approve/reject + org dashboard | approve/reject + org dashboard | request own, **own dashboard only** |
| Users management | full (+ create super_admin, delete) | non-super only (no delete) | **no** |
| Settings (read / write) | read+write | read+write | read-only (GET auth) / **no write** |
| Masters (read / write) | read+write | read+write | read-only / **no write** |
| Gold rates override | yes | yes | **no** |
| Analytics (sales/conversion/performance) | yes | yes | **no** (admin-gated router) |
| Audit log | yes | yes | **no** |

- `super_admin` is the only role that can mint/elevate another super_admin and soft-delete users (`requireSuperAdmin` on `DELETE /users/:id`).
- Enforcement is server-side; UI nav hiding is cosmetic.

---

## 6. Sidebar + Navigation

Defined in `client/src/components/Layout.jsx` — `BASE_NAV` (all roles) + `ADMIN_NAV` (filtered by `navFor(role)`).

**Sales-executive sidebar:** Dashboard · Create Quotation · Quotation History · Leads · Customers · Attendance · Leaves · Tasks.

**Admin / super_admin sidebar:** all of the above **plus** Employees · Shifts · Incentives · HR Calendar · Users · Settings · Masters · Gold Rates.

- Desktop (`lg+`): dark sticky sidebar, scroll-locked (only `<main>` scrolls). Mobile: fixed top bar + hamburger slide-out drawer (auto-closes on route change, body scroll locked while open).
- Identity + role + Sign Out pinned at sidebar footer.
- Route guards in `router.jsx` wrap admin pages in `<RequireRole roles={['super_admin','admin']}>` — defense matches nav filtering.

---

## 7. Dashboard (role-split — verified in `Dashboard.jsx`)

**Admin / super_admin widgets:**
- CRM: Total Leads, Due Followups, Converted Leads, Lost Leads.
- Relationship: Total Customers, Repeat Customers, Due Reminders (overdue/today/upcoming hint), Total Quotations.
- HR (org-wide): Present Today, Absent Today, On Leave Today, Pending Approvals.
- Tasks/Incentives: Pending Tasks, Overdue Tasks, Completed Today, Incentive Pending (₹ + count).
- KPI: Conversion Rate card, Sales Performance (per-executive) table, Employee Performance table.
- Live Gold Rate widget + Recent Quotations.

**Sales-executive widgets (all self-scoped, server-enforced):**
- My CRM: My Leads, My Followups, My Customers, My Quotations.
- My Work: My Reminders, My Pending Tasks, My Overdue Tasks, My Completed Today.
- My HR: My Attendance Today (own status), My Leave Status (own pending + on-leave-today hint), My Incentives (own total / pending / paid).
- Live Gold Rate widget + Recent Quotations (own).

**RBAC rule:** sales-exec **never** sees org attendance counts, pending-approval queues, team HR metrics, conversion/sales/employee-performance tables, or org incentive totals — enforced both by conditional rendering **and** by backend scoping (`/attendance/today` is admin-gated; sales-exec uses `/attendance/my-today` and `/incentives/my-summary`; leads/customers/reminders/tasks/leaves dashboards scope by actor).

---

## 8. CRM Modules

**Quotation** — Create → live pricing (pure fn: Gold = net_wt × rate; Diamond = carat × rate; Making = per_gram | fixed | percentage; subtotal + GST `GST_RATE` → final) → preview (iframe `srcDoc`) → A4 PDF (Puppeteer) → save → history. Rates frozen on the row at create time; old quotes never re-price. Dropdowns sourced from master tables (hardcoded fallback if empty).

**Leads** — `leads` + `lead_followups` + `lead_sources` + `lead_statuses`. Code `LD-YYYY-NNNN`. Pipeline statuses with `is_terminal` (Converted/Lost). Followup timeline, filters/search, ownership-scoped. "Create Quotation from lead" autofills (`?lead=`) and stamps `source_lead_id`.

**Customers** — `customers` (mobile = UNIQUE dedupe identity) + `customer_events` timeline + `reminder_tasks`. Code `CUST-YYYY-NNNN`. Repeat-customer intelligence (quotation_count by mobile).

**Followups** — per-lead, due-followup detection (`next_followup_at <= now`), surfaced on dashboard + HR calendar.

**Reminders** — `reminder_tasks` with overdue/today/upcoming buckets; mark-done; dashboard counts (scoped).

**Conversion** — lead → Converted (manual) OR quote-from-lead (auto): flips lead to terminal Converted, stamps `converted_at` + `converted_quotation_id`, and ensures a customer via `customers.ensureFromLead` (mobile dedupe, idempotent). Audit `lead.converted` / `lead.converted_auto`.

**Analytics** — admin-only router (`requireAuth, requireAdmin`): sales (per-exec), conversion rate, employee performance (joins quotes/leads/customers/reminders/attendance/leaves/tasks/incentives).

**History filters (M3.5)** — backend-driven search/date/product/status/price/sort, debounced 250 ms, latest-request-id guard, role-scoped.

**WhatsApp** — template send (`quotation_document`); recipient is always the customer mobile; status (`whatsapp_status`, `whatsapp_message_id`, `whatsapp_sent_at`, `whatsapp_error`) on the row.

**PDF** — auth-aware fetch via axios (blob / srcDoc) so JWT rides along; native `<iframe src>`/`<a href>` would bypass the interceptor and 401.

---

## 9. HRMS Modules

**Employees** — admin-only router. Directory + profile (incl. **birthday**, manager, shift). `EMP-YYYY-NNNN`, auto-seeded one-per-user. Soft deactivate (sets `is_active=false`, `employment_status=resigned`).

**Attendance** — mark (sales-exec self only; admin anyone), unique per employee+day (409 on dup), admin edit. Org today counts admin-only (`/today`); self status via `/my-today`.

**Leaves** — request (self / admin-for-anyone), admin approve/reject. Dashboard scoped (own for sales-exec, org for admin).

**Shifts** — admin-only. CRUD + employee assignment. **Lifecycle Active↔Inactive**: `DELETE /shifts/:id` deactivates (`shift.deactivate`); `PUT /shifts/:id/activate` reactivates (`shift.activate`). UI shows Edit|Off for active, Edit|On for inactive. Editing an inactive shift does not silently reactivate. Assignments persist across deactivate/reactivate.

**Tasks** — assignee scoping; sales-exec self-assign + status-only update; admin full. Overdue logic, dashboard counts (scoped).

**Incentives** — `incentives` draft→approved→paid. Admin create/approve/pay/see-all; sales-exec **view own only** + dashboard self-summary (`/incentives/my-summary` → total/pending/paid). Types: percentage | fixed | target_bonus.

**Compensation (payroll foundation)** — `employee_compensation` (salary_type, base, allowance, deduction, overtime_rate, commission_eligible). Admin-only. Not a full payroll/payslip engine yet.

**Document Vault** — `employee_documents`, admin-only. Multipart upload (PNG/JPG/WEBP/PDF, 10 MB), category, soft-delete. Files served from `/uploads`; client opens via `assetUrl()` (resolves to API origin). **Files are lost on Render redeploy** (ephemeral disk) — DB URL persists, file vanishes.

**HR Calendar** — admin-only. Full month grid (prev/next/today nav, today highlight, per-day event dots, click-day modal). **Two sources:** AUTO (approved leaves, birthdays, work anniversaries, pending leave approvals, due lead followups, task deadlines — each query isolated so one failure can't blank the calendar) + MANUAL (`calendar_events`: title, description, date, category, created_by, active). Admin create/edit/delete manual events; duplicate same-title+same-date rejected (partial unique index + service check). Audit `calendar.create/update/delete`.

**Known HRMS limitations:** payroll is foundation-only (no payslip generation); document files ephemeral; no biometric/geo attendance; birthdays/anniversaries derive from `employees` date columns (must be populated to appear).

---

## 10. Audit System

- **Model:** `audit_events(id, actor_user_id, actor_email [denormalised], action, entity_type, entity_id [text], metadata jsonb, ip, user_agent, created_at)`. Indexed by actor, action, entity.
- **Mechanism:** `audit.record({ actor, action, entityType, entityId, metadata, req })` — fire-and-forget, never throws into the request.
- **Naming convention:** `entity.action` (lowercase, dot-separated; status variants use `entity.<status>`).
- **Tracked actions (verified):** `auth.login`, `auth.login_failed`, `user.create/update/password_reset/deactivate`, `settings.update`, `master.<...>`, `lead.create/update/assign/followup.add/converted/converted_auto`, `customer.update/note/reminder.add/reminder.done`, `employee.create/update/deactivate/document.add/document.deactivate`, `compensation.update`, `attendance.mark/edit`, `leave.request/<approve|reject>`, `shift.create/update/deactivate/activate/assign`, `task.create/update`, `incentive.create/<status>`, `calendar.create/update/delete`.
- **Access:** audit log readable by admin/super only (`/api/audit`, `requireAdmin`).

---

## 11. UI / UX Rules

- **Theme:** luxury gold (`#C5A028`) + black/ink (`#111`) + off-white; serif (Lora) headings + sans (Poppins) body; defined as Tailwind tokens. Cards have gold left-border accents; section titles in gold uppercase tracking.
- **Sidebar/nav:** dark, scroll-locked sticky on `lg+` (only `<main>` scrolls); hamburger drawer on mobile; role-filtered (`navFor(role)`); identity + Sign Out pinned bottom.
- **Layout/spacing:** `max-w-6xl` content column, generous padding, `gap-4 sm:gap-6` widget grids (2-col mobile → 4-col desktop).
- **Card style:** white card, gold left border (`border-l-4 border-l-gold`); red border/text for alert states (overdue, absent, unmarked).
- **Modals:** centered overlay (`bg-black/60`), gold left-border card; backdrop click closes; toasts inline, 4 s auto-dismiss.
- **Responsive pattern:** desktop = tables; mobile = cards. Filter toolbars consistent across CRM/HRMS (debounced search, latest-request-id guard discards stale responses).
- **Dashboard philosophy:** role determines what data is even fetched, not just shown. Admin = org overview + KPI tables; sales-exec = strictly "My …" self view. No org HR/analytics for sales-exec at UI or API.
- **PDF preview:** iframe `srcDoc` (HTML fetched via axios) + blob URL for PDF (JWT-aware).

**Historical UI/UX fixes & why**
1. Validation hint box removed — user found "fill inputs" banner noise.
2. Mobile responsiveness pass — hamburger drawer, card layouts for History/Preview/Create actions; action bars moved below pricing on mobile to stop clipping.
3. Nav "active" bug — `Dashboard` highlighted alongside `Quotation History`; fixed with `end` matching on `NavLink`.
4. Sticky sidebar — page used to scroll with content; switched to ERP scroll-lock (outer `h-screen overflow-hidden`, only `<main>` scrolls).
5. Quotation PDF whitespace — `@page A4` + viewport 794×1123 + tightened padding for edge-to-edge fill.
6. Doc-vault "Not Found" — relative `/uploads/..` resolved against client origin; added `assetUrl()` to target API origin.
7. HR calendar "blank" — `month()` selected a non-existent `birthday` column → query threw → calendar 500'd to empty; added the column + isolated each auto-source query + full grid UI.

---

## 12. Env + Deployment

**Render:** `jbos-api` (Node web service, https://jbos-api.onrender.com) + `jbos-client` (static/web, https://jbos-client.onrender.com). Free tier → cold-start ~50 s after idle. Auto-deploy on push to `main`.

**Neon:** PostgreSQL; connection string in `DATABASE_URL` (sslmode=require). Schema/migrations/seeds run on boot — no manual SQL.

**Server env (`server/.env` local; Render env prod):**
```
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@HOST/DB?sslmode=require
PG_POOL_MAX=5
UPLOAD_DIR=../uploads
TEMPLATE_DIR=../templates
CLIENT_ORIGIN=https://jbos-client.onrender.com    # CORS allow-origin
GST_RATE=0.03
# Auth
JWT_SECRET=<32+ char random>
JWT_EXPIRES_IN=24h
SEED_ADMIN_EMAIL=<first super admin>
SEED_ADMIN_PASSWORD=<8+ chars>
SEED_ADMIN_NAME=Super Admin
# Gold
GOLD_PROVIDER=goldapi            # mock | goldapi | http
GOLD_API_KEY=<goldapi.io key>
GOLD_API_SYMBOL=XAU
GOLD_API_CURRENCY=INR
GOLD_USE_MARKUP=true
GOLD_INDIA_MARKUP_PCT=18
GOLD_FETCH_ENABLED=true
GOLD_FETCH_CRON=0 9 * * *
TZ=Asia/Kolkata
# WhatsApp
WHATSAPP_TOKEN=<permanent token>
WHATSAPP_PHONE_NUMBER_ID=<id>
WHATSAPP_WABA_ID=<id>
WHATSAPP_GRAPH_VERSION=v20.0
WHATSAPP_TEMPLATE_NAME=quotation_document
WHATSAPP_TEMPLATE_LANG=en
```

**Client env:**
```
VITE_API_BASE_URL=https://jbos-api.onrender.com   # empty → relative /api (dev proxy)
```
> `assetUrl()` uses this same base to resolve `/uploads/...` document links to the API origin in production.

**API URLs:** all API calls go to `<VITE_API_BASE_URL>/api/...`; uploads served at `<VITE_API_BASE_URL>/uploads/...`.

**Deployment flow:** commit → push `main` → Render rebuilds both services → API boots → advisory-locked schema apply + migrations + seeds → live.

**Migration boot strategy:** see §4 (advisory lock + idempotent schema + guarded ALTERs + deferred indexes).

**Local dev quickstart:**
```bash
# Server
cd server
copy .env.example .env     # fill DATABASE_URL (Neon dev branch) + JWT_SECRET + SEED_ADMIN_*
npm install
npm run dev                # nodemon; boots schema + seeds + bootstrap admin

# Client (separate terminal)
cd client
npm install
npm run dev                # Vite :5173, proxies /api and /uploads → :5000
```
- First boot creates super_admin from `SEED_ADMIN_*` and clears demo quotations.
- `npm run user:bootstrap --prefix server` — manual super_admin bootstrap.
- Port 5000 stuck on Windows: `Get-NetTCPConnection -LocalPort 5000 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`.

---

## 13. Known Limitations (verified)

- **Render free tier:** cold-start ~50 s after idle; both services sleep.
- **Ephemeral disk:** employee docs + product images on Render local disk are **lost on every redeploy**. DB URLs persist, files vanish. → object storage planned for M8.
- **WhatsApp policy:** uses approved template (delivers anytime); Meta returns a `wamid` on accept even if delivery is later dropped. No delivery webhook wired, so DB status reflects "accepted", not "delivered".
- **No pagination cursor:** list endpoints cap at 500–1000 rows. Fine at current scale.
- **No refresh token:** 24 h JWT expiry forces re-login.
- **Single-tenant:** one business; multi-tenant would need tenant scoping.
- **Payroll:** compensation is a foundation only — no payslip generation/run.
- **Provider dependency:** gold pricing depends on goldapi.io; India retail markup is a configurable approximation, not a live IBJA feed.
- **Secrets exposure:** goldapi key, WhatsApp token, and a Neon password were pasted into the build chat during development — rotate before wide release.

---

## 14. Open Issues / Pending Items

### A. Verified Open Bugs
- **None known.** The five M7 issues (shift re-activation, sales-exec incentive visibility, doc-vault "Not Found", basic/blank HR calendar, dashboard RBAC leak) are **resolved** in `e66c03f`.
- ⏳ Awaiting the user's **authenticated browser smoke** of `e66c03f` on the live Render deploy (cold-start ~50 s). Smoke checklist was delivered with the fix-pack push.

### B. Housekeeping (non-blocking)
- Working tree has stray junk files from earlier shell-redirect mishaps (e.g. `,`, `{`, `0)`, `!item.roles`, `r.data.data)`) — untracked, harmless, can be deleted.
- Rotate dev secrets (see §13) before any wide release.

---

## 15. Roadmap

- **Next: M8 — Inventory. Status: not yet started.**
- Anticipated M8 scope: products/SKUs, stock by location, stock movements (in/out/transfer), supplier links, low-stock alerts, link inventory items to quotation line items, and **object storage** (S3/Cloudinary) to replace Render ephemeral disk for product + employee document images.
- M9+ (future): vendors/purchase/finance ERP, real payroll + payslips, WhatsApp delivery webhooks, pagination cursors, refresh tokens.

---

## 16. Session Handoff — NEW CHAT QUICKSTART

- **Current state:** JBOS is live on Render (client + API + Neon). V1 + M1–M7 shipped; M7 fix pack (`e66c03f`) deployed. M8 not started.
- **Latest commit:** `e66c03f` on `main` (pushed).
- **Next task:** confirm the user's authenticated smoke of `e66c03f`, then — only on explicit approval — begin **M8 (Inventory)**. Do not start M8 unprompted (the user gates every milestone behind approval after smoke).
- **What a future Claude must read first:**
  1. This file (`docs/prcontext.md`) — full verified context.
  2. `git log --oneline` — confirm latest commit / nothing changed since.
  3. `server/src/database/schema.sql` + `server/src/database/connection.js` — schema + the deferred-index migration rule (do not break it).
  4. `client/src/components/Layout.jsx` (nav/RBAC) + `client/src/pages/Dashboard.jsx` (role-split widgets) + `client/src/api/client.js` (all API bundles + `assetUrl`).
- **Working conventions:** server-side RBAC scoping is mandatory (UI hiding alone is not acceptable); migrations must stay boot-safe/idempotent; never break Render deploy stability; commit per milestone; terse chat replies; caveman mode may be active (code/commits/security still written normally).

---

*End of verified handoff. Regenerate against `git log` + schema + routes if anything below the latest commit has changed.*
