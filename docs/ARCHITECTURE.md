# JBOS V1 — Architecture Notes

## Design Principles

1. **Single module scope** — V1 ships only the Quotation module. No coupling to future CRM/HRMS/Inventory layers.
2. **Service-based backend** — Controllers are thin; all business logic lives in `services/`. Pricing is a pure function (no DB) for testability.
3. **Template-driven PDF** — Visual design lives in a single HTML file (`templates/quotation.template.html`). The renderer does only `{{placeholder}}` substitution; no design logic in JS.
4. **Frozen pricing snapshot** — On `POST /quotations`, all rates (gold/diamond/making) are written into the row. Future rate changes never mutate historical quotes.
5. **Scalable folders** — `routes/ → controllers/ → services/ → database/` mirrors the path future modules will follow.

## Data Flow

```
React Form
   │  POST /api/quotations/calculate   (live preview)
   │  POST /api/quotations             (persist)
   ▼
Express Controller
   ▼
quotation.service.create()
   ├─► pricing.service.computePricing()  (pure)
   ├─► utils/quoteId.generateQuoteId()
   └─► SQLite INSERT
            │
            ▼
   GET /api/quotations/:id/preview
   ├─► template.service.renderQuotationHtml(row)
   └─► returns HTML

   GET /api/quotations/:id/pdf
   ├─► template.service.renderQuotationHtml(row)
   ├─► pdf.service.generatePdf(html)  (Puppeteer)
   └─► returns application/pdf
```

## SQLite Tables

| Table            | Purpose                                                |
|------------------|--------------------------------------------------------|
| `quotations`     | All quote rows + frozen pricing snapshot               |
| `gold_rates`     | Master gold rates by purity                            |
| `diamond_rates`  | Master diamond rates by shape/clarity/color            |
| `gemstone_rates` | Master gemstone rates by name/grade                    |
| `making_charges` | Making charge templates by product category            |

## Quote ID Format

`QT-YYYY-NNNN` — zero-padded sequence per calendar year (e.g. `QT-2026-0001`).

## Template Placeholders

Substitution regex: `\{\{\s*([a-zA-Z0-9_]+)\s*\}\}`

Available tokens (see `template.service.js` for full map):

- Company:  `company_name`, `company_tagline`, `company_address`, `company_contact`, `company_web`, `company_gstin`
- Meta:     `quote_id`, `status`, `quotation_date`, `valid_till`, `sales_executive`
- Customer: `customer_name`, `customer_mobile`, `customer_email`, `occasion`
- Product:  `product_name`, `product_category`, `product_description`, `product_image`
- Specs:    `metal_type`, `metal_color`, `purity`, `gross_weight`, `net_weight`, `diamond_*`, `gemstone`, `hallmark`, `certification`, `setting_style`
- Rates:    `gold_rate_per_gram`, `diamond_rate_per_carat`, `making_rate`
- Pricing:  `gold_cost`, `diamond_cost`, `gemstone_cost`, `making_charge`, `hallmark_charge`, `certification_charge`, `shipping_charge`, `subtotal`, `gst_percent`, `gst_amount`, `final_price`
- Footer:   `generated_on`, `prepared_by`

## Environment Variables (server/.env)

| Var              | Default                          |
|------------------|----------------------------------|
| `PORT`           | `5000`                           |
| `NODE_ENV`       | `development`                    |
| `DB_PATH`        | `../database/jbos.db`            |
| `UPLOAD_DIR`     | `../uploads`                     |
| `TEMPLATE_DIR`   | `../templates`                   |
| `CLIENT_ORIGIN`  | `http://localhost:5173`          |
| `GST_RATE`       | `0.03`                           |
| `COMPANY_*`      | optional brand overrides         |

## Future-Proofing

- Add new modules under sibling `server/src/routes/<module>.routes.js` — pattern already established.
- Add new tables in `schema.sql` (idempotent `CREATE IF NOT EXISTS`).
- Add new client pages under `client/src/pages/` and register in `router.jsx`.
- Authentication & multi-tenancy hooks are intentionally absent in V1; introduce as a middleware layer when added.
