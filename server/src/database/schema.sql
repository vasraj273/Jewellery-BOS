-- ============================================================
-- JBOS V1 SQLite Schema
-- Quotation module only. Idempotent (CREATE IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS quotations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id            TEXT    NOT NULL UNIQUE,
  status              TEXT    NOT NULL DEFAULT 'draft',  -- draft | sent | accepted | expired

  -- Customer
  customer_name       TEXT    NOT NULL,
  customer_mobile     TEXT,
  customer_email      TEXT,
  occasion            TEXT,

  -- Product
  product_name        TEXT,
  product_category    TEXT,
  product_description TEXT,
  product_image_path  TEXT,

  -- Metal
  metal_type          TEXT,                  -- Gold | Platinum | Silver
  metal_color         TEXT,                  -- Yellow | White | Rose
  purity              TEXT,                  -- 22Kt | 18Kt | 14Kt ...
  gross_weight        REAL DEFAULT 0,        -- grams
  net_weight          REAL DEFAULT 0,        -- grams

  -- Diamond
  diamond_type        TEXT,                  -- Natural | Lab | None
  diamond_shape       TEXT,
  diamond_carat       REAL DEFAULT 0,
  diamond_clarity     TEXT,
  diamond_color       TEXT,

  -- Gemstone
  gemstone            TEXT,
  gemstone_carat      REAL DEFAULT 0,

  -- Certifications
  hallmark            TEXT,
  certification       TEXT,
  setting_style       TEXT,

  -- Rates snapshot (frozen at creation)
  gold_rate_per_gram      REAL DEFAULT 0,
  diamond_rate_per_carat  REAL DEFAULT 0,
  gemstone_rate_per_carat REAL DEFAULT 0,

  -- Making
  making_charge_type      TEXT DEFAULT 'per_gram',   -- per_gram | fixed | percentage
  making_charge_value     REAL DEFAULT 0,

  -- Extras
  hallmark_charge         REAL DEFAULT 0,
  certification_charge    REAL DEFAULT 0,
  shipping_charge         REAL DEFAULT 0,

  -- Computed
  gold_cost           REAL DEFAULT 0,
  diamond_cost        REAL DEFAULT 0,
  gemstone_cost       REAL DEFAULT 0,
  making_charge       REAL DEFAULT 0,
  subtotal            REAL DEFAULT 0,
  gst_rate            REAL DEFAULT 0.03,
  gst_amount          REAL DEFAULT 0,
  final_price         REAL DEFAULT 0,

  -- Meta
  pricing_location    TEXT,
  sales_executive     TEXT,
  valid_till          TEXT,
  notes               TEXT,
  pdf_path            TEXT,

  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quotations_quote_id   ON quotations(quote_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_customer   ON quotations(customer_name);

-- ============================================================
-- Rate Master Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS gold_rates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  location    TEXT NOT NULL DEFAULT 'Mumbai',-- city (preferred) or state
  purity      TEXT NOT NULL,                 -- 24Kt | 22Kt | 18Kt | 14Kt
  rate_per_gram REAL NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual',-- mock | <provider> | manual
  is_override INTEGER NOT NULL DEFAULT 0,    -- 1 = admin override; wins over live
  effective_date TEXT NOT NULL DEFAULT (date('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- idx_gold_rates_loc_purity is created in connection.js after column migrations.

CREATE TABLE IF NOT EXISTS diamond_rates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shape       TEXT NOT NULL,                 -- Round | Princess | Oval ...
  clarity     TEXT,                          -- VVS1 | VS1 | SI1 ...
  color       TEXT,                          -- D | E | F | G ...
  rate_per_carat REAL NOT NULL,
  effective_date TEXT NOT NULL DEFAULT (date('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diamond_rates_shape ON diamond_rates(shape, effective_date DESC);

CREATE TABLE IF NOT EXISTS gemstone_rates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  gemstone    TEXT NOT NULL,                 -- Ruby | Emerald | Sapphire ...
  grade       TEXT,
  rate_per_carat REAL NOT NULL,
  effective_date TEXT NOT NULL DEFAULT (date('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gemstone_rates_name ON gemstone_rates(gemstone, effective_date DESC);

CREATE TABLE IF NOT EXISTS making_charges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL,                 -- Ring | Necklace | Bangle ...
  charge_type TEXT NOT NULL,                 -- per_gram | fixed | percentage
  charge_value REAL NOT NULL,
  effective_date TEXT NOT NULL DEFAULT (date('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_making_charges_cat ON making_charges(category, effective_date DESC);
