/**
 * Format number to Indian Rupee string (no decimals): "₹ 1,28,935"
 */
export function formatINR(n) {
  const num = Number(n) || 0;
  return `₹ ${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Format ISO date to "24 May, 2025"
 */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
