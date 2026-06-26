import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatINR, formatDate } from '../utils/format.js';
import * as settings from './settings.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_DIR = path.resolve(__dirname, '..', '..', process.env.TEMPLATE_DIR || '../templates');
const TEMPLATE_FILE = path.join(TEMPLATE_DIR, 'quotation.template.html');
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || '../uploads');

// Default logo when no company logo is configured (original luxury star mark).
const DEFAULT_LOGO_SVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="14,1 17.5,9.5 27,11 20.5,17.5 22,27 14,23 6,27 7.5,17.5 1,11 10.5,9.5" stroke="#C5A028" stroke-width="0.8" fill="#F9F4E8" stroke-linejoin="round"/>
  <circle cx="14" cy="14" r="4" stroke="#C5A028" stroke-width="0.6" fill="none"/>
  <circle cx="14" cy="14" r="1.5" fill="#C5A028"/>
</svg>`;

// Placeholder icon shown in the product showcase when no image is attached.
const PRODUCT_PLACEHOLDER_SVG = `<div class="img-placeholder-icon">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="42" height="42" rx="2" stroke="#C5A028" stroke-width="0.8"/>
    <circle cx="15" cy="15" r="5" stroke="#C5A028" stroke-width="0.8"/>
    <path d="M3 33 L14 21 L22 29 L32 17 L45 33" stroke="#C5A028" stroke-width="0.8" stroke-linejoin="round"/>
  </svg>
</div>`;

let cached = null;
function loadTemplate() {
  if (cached && process.env.NODE_ENV === 'production') return cached;
  cached = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
  return cached;
}

/**
 * Render the master quotation template with a quotation row.
 * Replaces {{placeholder}} tokens. Company identity is read from
 * company_settings (in-process cached); env fallbacks removed in M3.
 */
export async function renderQuotationHtml(q) {
  const tpl = loadTemplate();
  const cs = (await settings.get()) || {};

  const placeholders = {
    // Company identity — DB-driven via company_settings (M3).
    company_name:    cs.company_name    || 'JBOS',
    company_tagline: cs.company_tagline || '',
    company_address: cs.company_address || '',
    company_contact: cs.company_contact || '',
    company_web:     cs.company_web     || '',
    company_gstin:   cs.company_gstin   || '',

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
    product_image:           buildImageTag(q.product_image_path),
    product_image_placeholder: q.product_image_path ? '' : PRODUCT_PLACEHOLDER_SVG,
    company_logo:        buildLogoTag(cs.company_logo_url),

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
  const src = resolveImageSrc(imgPath);
  if (!src) return '';
  return `<img src="${src}" alt="Product" style="max-width:100%;max-height:160px;object-fit:contain;" />`;
}

function buildLogoTag(logoUrl) {
  const src = resolveImageSrc(logoUrl);
  if (!src) return DEFAULT_LOGO_SVG;
  return `<img src="${src}" alt="Logo" style="max-width:48px;max-height:48px;object-fit:contain;" />`;
}

/**
 * Resolve a stored image reference into something Puppeteer can render from a
 * `setContent()` page (which has no base URL). External http(s) URLs pass
 * through; locally-uploaded files are inlined as base64 data URIs so they
 * render regardless of server origin / network reachability.
 */
function resolveImageSrc(ref) {
  if (!ref) return '';
  if (/^https?:\/\//i.test(ref) || ref.startsWith('data:')) return ref;
  // Local upload: strip a leading "/uploads/" (or "uploads/") to get the filename.
  const filename = path.basename(ref);
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : (ext || 'png');
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  } catch {
    // File missing (e.g. wiped on a Render redeploy) — degrade gracefully.
    return '';
  }
}
