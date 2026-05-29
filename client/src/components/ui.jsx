// Shared UI primitives for the JBOS layout system (M9.5).
// Presentation only — no business logic, no data fetching.

/** Consistent page header: title + subtitle + optional right-aligned actions. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">{title}</h1>
        {subtitle && <p className="text-xs uppercase tracking-[3px] text-gold mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:gap-3 self-start sm:self-auto">{actions}</div>}
    </div>
  );
}

/** Compact filter/action toolbar wrapper. */
export function Toolbar({ children, className = '' }) {
  return <div className={`toolbar ${className}`}>{children}</div>;
}

// Canonical status → tone map. Anything not listed falls back to neutral.
const STATUS_TONE = {
  // success
  active: 'success', delivered: 'success', paid: 'success', approved: 'success',
  completed: 'success', present: 'success', in_stock: 'success', done: 'success',
  // warning / in-progress / pending
  pending: 'warning', reserved: 'warning', in_progress: 'warning', production: 'warning',
  issued: 'warning', followup: 'warning', half_day: 'warning', draft_sent: 'warning',
  // danger
  overdue: 'danger', delayed: 'danger', rejected: 'danger', cancelled: 'danger',
  lost: 'danger', absent: 'danger', urgent: 'danger',
  // info
  confirmed: 'info', ready: 'info', received: 'info', repair: 'info',
  custom_order: 'info', new: 'info', sent: 'info',
  // neutral
  draft: 'neutral', sold: 'neutral', archived: 'neutral', resigned: 'neutral', cancelled_neutral: 'neutral'
};

/** Standardised status pill. Pass `tone` to override the inferred colour. */
export function StatusBadge({ status, tone, label }) {
  const key = String(status || '').toLowerCase();
  const t = tone || STATUS_TONE[key] || 'neutral';
  const cls = { success: 'badge-success', warning: 'badge-warning', danger: 'badge-danger', info: 'badge-info', neutral: 'badge-neutral' }[t];
  return <span className={cls}>{label || key.replace(/_/g, ' ') || '—'}</span>;
}

/** A single shimmer block. */
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} />;
}

/** Shimmer rows for a loading table body. */
export function SkeletonRows({ rows = 6, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gold-light/10">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3"><Skeleton className="h-4 w-3/4" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Friendly empty-state cell/row content. */
export function EmptyState({ title = 'Nothing here yet', hint, colSpan }) {
  const body = (
    <div className="py-10 text-center">
      <div className="text-sm text-ink-mid">{title}</div>
      {hint && <div className="text-xs text-ink-muted mt-1">{hint}</div>}
    </div>
  );
  // Usable both inside a table (with colSpan) and as a standalone block.
  return colSpan ? <tr><td colSpan={colSpan}>{body}</td></tr> : body;
}

/** Simple tab strip. tabs = [{key,label}]; controlled via value/onChange. */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gold-light/40 mb-6 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-xs uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition ${
            value === t.key ? 'border-gold text-gold font-medium' : 'border-transparent text-ink-muted hover:text-gold'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
