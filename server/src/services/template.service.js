import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatINR, formatDate } from '../utils/format.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_DIR = path.resolve(__dirname, '..', '..', process.env.TEMPLATE_DIR || '../templates');
const TEMPLATE_FILE = path.join(TEMPLATE_DIR, 'quotation.template.html');

let cached = null;
function loadTemplate() {
  if (cached && process.env.NODE_ENV === 'production') return cached;
  cached = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
  return cached;
}

/**
 * Render the master quotation template with a quotation row.
 * Replaces {{placeholder}} tokens.
 */
export function renderQuotationHtml(q) {
  const tpl = loadTemplate();

  const placeholders = {
    // company defaults (can be overridden via env later)
    company_name:    process.env.COMPANY_NAME    || 'Aurum Atelier',
    company_tagline: process.env.COMPANY_TAGLINE || 'Fine Custom Jewellery · Est. 2008',
    company_address: process.env.COMPANY_ADDRESS || '14, Jewellers Row, Zaveri Bazaar<br>Mumbai — 400 002, Maharashtra, India',
    company_contact: process.env.COMPANY_CONTACT || '+91 98200 XXXXX · atelier@aurum.in',
    company_web:     process.env.COMPANY_WEB     || 'www.aurumatelier.com · @aurum_atelier',
    company_gstin:   process.env.COMPANY_GSTIN   || 'GSTIN: 27AAXCA1234R1Z5',

    // quotation meta
    quote_id:        q.quote_id || '',
    status:          (q.status || 'Draft').toUpperCase(),
    quotation_date:  formatDate(q.created_at),
    valid_till:      formatDate(q.valid_till),
    sales_executive: q.sales_executive || '—',

    // customer
    customer_name:   q.customer_name || '',
    customer_mobile: q.customer_mobile || '',
    customer_email:  q.customer_email || '',
    occasion:        q.occasion || '',

    // product
    product_name:        q.product_name || '',
    product_category:    q.product_category || '',
    product_description: q.product_description || '',
    product_image:       buildImageTag(q.product_image_path),

    // specs
    metal_type:     q.metal_type || '—',
    metal_color:    q.metal_color || '—',
    purity:         q.purity || '—',
    gross_weight:   fmtWeight(q.gross_weight),
    net_weight:     fmtWeight(q.net_weight),
    diamond_type:   q.diamond_type || '—',
    diamond_shape:  q.diamond_shape || '—',
    diamond_carat:  q.diamond_carat ? `${q.diamond_carat} Ct` : '—',
    diamond_clarity: q.diamond_clarity || '',
    diamond_color:   q.diamond_color || '',
    gemstone:       q.gemstone || 'None',
    hallmark:       q.hallmark || '—',
    certification:  q.certification || '—',
    setting_style:  q.setting_style || '—',

    // rates
    gold_rate_per_gram:      formatINR(q.gold_rate_per_gram),
    diamond_rate_per_carat:  formatINR(q.diamond_rate_per_carat),
    gemstone_rate_per_carat: formatINR(q.gemstone_rate_per_carat),
    making_rate:             formatMakingRate(q),

    // pricing
    gold_cost:           formatINR(q.gold_cost),
    diamond_cost:        formatINR(q.diamond_cost),
    gemstone_cost:       q.gemstone_cost ? formatINR(q.gemstone_cost) : '—',
    making_charge:       formatINR(q.making_charge),
    hallmark_charge:     formatINR(q.hallmark_charge),
    certification_charge: formatINR(q.certification_charge),
    shipping_charge:     formatINR(q.shipping_charge),
    subtotal:            formatINR(q.subtotal),
    gst_percent:         `${((q.gst_rate || 0.03) * 100).toFixed(0)}%`,
    gst_amount:          formatINR(q.gst_amount),
    final_price:         formatINR(q.final_price),

    // footer
    generated_on: formatDate(new Date().toISOString()),
    prepared_by:  q.sales_executive || 'System'
  };

  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return placeholders[key] != null ? String(placeholders[key]) : '';
  });
}

function fmtWeight(g) {
  const n = Number(g);
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n.toFixed(3)} gm`;
}

function formatMakingRate(q) {
  const v = q.making_charge_value || 0;
  switch (q.making_charge_type) {
    case 'per_gram':   return `${formatINR(v)} / gm`;
    case 'fixed':      return formatINR(v);
    case 'percentage': return `${v}%`;
    default:           return formatINR(v);
  }
}

function buildImageTag(imgPath) {
  if (!imgPath) return '';
  const src = imgPath.startsWith('http') || imgPath.startsWith('/') ? imgPath : `/uploads/${imgPath}`;
  return `<img src="${src}" alt="Product" style="max-width:100%;max-height:160px;object-fit:contain;" />`;
}
