import { quotationsApi } from './client.js';

/**
 * Fetch the quotation PDF through axios (so the Authorization header rides
 * along), then expose it via blob URL.
 *
 *   action: 'open'     → window.open(url, '_blank')
 *   action: 'download' → trigger a hidden <a download> click
 *
 * Returns the blob URL the caller may revoke later. We revoke automatically
 * after 60 s to avoid retaining the blob in memory if the tab stays open.
 */
export async function openQuotationPdf(quoteId, { action = 'open' } = {}) {
  const blob = await quotationsApi.pdfBlob(quoteId);
  const url = URL.createObjectURL(blob);

  if (action === 'download') {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quoteId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}
