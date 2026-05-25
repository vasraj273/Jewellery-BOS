# JBOS — Jewellery Business Operating System (V1)

Production-grade luxury jewellery **quotation generation** system.

V1 ships only the **Quotation Module**. CRM, HRMS, Inventory, Manufacturing, Live APIs, Auth, and Customer Portal are explicitly **out of scope**.

---

## Stack

| Layer       | Tech                                      |
|-------------|-------------------------------------------|
| Frontend    | React 18 · Vite · Tailwind CSS · React Router |
| Backend     | Node.js · Express                         |
| Database    | SQLite (better-sqlite3)                   |
| PDF Engine  | Puppeteer (headless Chromium)             |
| Template    | HTML master template + `{{placeholder}}` tokens |
| Storage     | Local disk (`/uploads`)                   |

---

## Architecture

```
React Frontend (Vite, :5173)
        │  /api proxy
        ▼
Express API (:5000)
        │
        ├─► SQLite DB  (database/jbos.db)
        ├─► Template Renderer  (templates/quotation.template.html)
        └─► Puppeteer PDF
              ▼
        Downloadable Luxury Quotation PDF
```

---

## Folder Structure

```
root/
├── client/                     # React + Vite + Tailwind
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── router.jsx
│       ├── api/client.js
│       ├── components/Layout.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── CreateQuotation.jsx
│       │   ├── QuotationHistory.jsx
│       │   └── QuotationPreview.jsx
│       └── styles/index.css
│
├── server/                     # Express API
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js            # bootstrap
│       ├── app.js              # express app factory
│       ├── middleware/error.middleware.js
│       ├── routes/
│       │   ├── quotation.routes.js
│       │   ├── rates.routes.js
│       │   └── upload.routes.js
│       ├── controllers/
│       │   ├── quotation.controller.js
│       │   └── rates.controller.js
│       ├── services/
│       │   ├── quotation.service.js
│       │   ├── rates.service.js
│       │   ├── pricing.service.js      # pricing engine (pure)
│       │   ├── template.service.js     # {{placeholder}} renderer
│       │   └── pdf.service.js          # Puppeteer
│       ├── database/
│       │   ├── connection.js
│       │   ├── schema.sql              # quotations, gold/diamond/gemstone/making rates
│       │   ├── init.js
│       │   └── seed.js
│       └── utils/
│           ├── quoteId.js              # QT-YYYY-NNNN
│           └── format.js               # INR + date
│
├── templates/
│   └── quotation.template.html         # master HTML w/ {{placeholders}}
│
├── database/                           # SQLite file lives here
├── uploads/                            # local product images
├── docs/
│   └── ARCHITECTURE.md
│
├── jewellery_quotation.html            # original master design (frozen reference)
├── package.json                        # root scripts (concurrently)
└── README.md
```

---

## Setup

> Requires Node.js **18+** and npm.

### 1. Install dependencies (root + client + server)

```powershell
npm install
npm run install:all
```

### 2. Configure server environment

```powershell
copy server\.env.example server\.env
```

Edit `server/.env` as needed (defaults work for local dev).

### 3. Initialize database

```powershell
npm run db:init
npm run db:seed --prefix server   # optional: seed gold/diamond/gemstone/making rates
```

### 4. Run dev servers (concurrently)

```powershell
npm run dev
```

- Client → http://localhost:5173
- API    → http://localhost:5000/api/health

---

## API Endpoints (V1)

| Method | Path                                | Purpose                       |
|--------|-------------------------------------|-------------------------------|
| GET    | `/api/health`                       | Health probe                  |
| GET    | `/api/quotations`                   | List all quotations           |
| GET    | `/api/quotations/:quoteId`          | Fetch one                     |
| POST   | `/api/quotations`                   | Create + auto-price           |
| POST   | `/api/quotations/calculate`         | Live price preview (no save)  |
| GET    | `/api/quotations/:quoteId/preview`  | Rendered HTML preview         |
| GET    | `/api/quotations/:quoteId/pdf`      | Puppeteer PDF download        |
| DELETE | `/api/quotations/:quoteId`          | Remove                        |
| GET    | `/api/rates/gold`                   | Gold rate master              |
| GET    | `/api/rates/diamond`                | Diamond rate master           |
| GET    | `/api/rates/gemstone`               | Gemstone rate master          |
| GET    | `/api/rates/making`                 | Making charges master         |
| POST   | `/api/uploads/image`                | Multer image upload           |

---

## Pricing Engine

Implemented in `server/src/services/pricing.service.js` as a pure function.

```
Gold Cost     = Net Weight × Gold Rate
Diamond Cost  = Carat × Rate
Gemstone Cost = Carat × Rate
Making Charge = per_gram | fixed | percentage
Subtotal      = Gold + Diamond + Gemstone + Making + Hallmark + Cert + Shipping
GST           = 3% (env: GST_RATE)
Final Price   = Subtotal + GST
```

---

## Template System

The master luxury HTML (frozen in `jewellery_quotation.html`) has been converted
to `templates/quotation.template.html` with `{{placeholder}}` tokens.

The visual design is **not** redesigned — only hardcoded values were swapped for
placeholders such as `{{quote_id}}`, `{{customer_name}}`, `{{gold_cost}}`,
`{{final_price}}`, etc.

`template.service.js` performs the token substitution; `pdf.service.js` then
hands the rendered HTML to Puppeteer for a print-perfect A4 PDF.

---

## Workflow

```
Create Quotation (UI form)
        ↓
Form Entry (customer + jewellery + rates)
        ↓
Auto Calculation (live via /api/quotations/calculate)
        ↓
Save (POST /api/quotations) → frozen pricing snapshot in DB
        ↓
Preview (iframe → /api/quotations/:id/preview)
        ↓
Generate PDF (/api/quotations/:id/pdf)
        ↓
History (GET /api/quotations)
```

---

## Phase Status

| Phase | Scope                        | Status      |
|-------|------------------------------|-------------|
| 1     | Project foundation & scaffolding | ✅ Current |
| 2     | Full UI polish + image upload    | Pending     |
| 3     | Rate management UI               | Pending     |
| 4     | Filters / search / export        | Pending     |
| 5+    | CRM / HRMS / Inventory (future modules) | Out of V1 |

---

## License

Internal — Aurum Atelier / JBOS Project. All rights reserved.
