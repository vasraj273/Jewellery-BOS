/**
 * Validate quotation input.
 * Throws { status: 400, message } on first failure.
 */
export function validateQuotation(input = {}) {
  const errors = [];

  const required = {
    customer_name:    'Customer name',
    product_category: 'Product category',
    purity:           'Purity',
    net_weight:       'Net weight'
  };

  for (const [key, label] of Object.entries(required)) {
    const v = input[key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      errors.push(`${label} is required`);
    }
  }

  const numericNonNeg = [
    'gross_weight', 'net_weight',
    'diamond_carat', 'gemstone_carat',
    'gold_rate_per_gram', 'diamond_rate_per_carat', 'gemstone_rate_per_carat',
    'making_charge_value', 'hallmark_charge', 'certification_charge', 'shipping_charge'
  ];
  for (const key of numericNonNeg) {
    const v = input[key];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n)) errors.push(`${key} must be a valid number`);
    else if (n < 0)         errors.push(`${key} cannot be negative`);
  }

  if (Number(input.net_weight) <= 0) errors.push('Net weight must be greater than zero');

  const validMaking = ['per_gram', 'fixed', 'percentage'];
  if (input.making_charge_type && !validMaking.includes(input.making_charge_type)) {
    errors.push(`making_charge_type must be one of ${validMaking.join(', ')}`);
  }

  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }
}
