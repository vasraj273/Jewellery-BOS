import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { quotationsApi, leadsApi, customersApi, remindersApi, analyticsApi, attendanceApi, leavesApi, tasksApi, incentivesApi, inventoryApi, salesOrdersApi, productionApi, jobWorksApi, repairsApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import GoldRateWidget from '../components/GoldRateWidget.jsx';

const ADMIN_ROLES = ['super_admin', 'admin'];

export default function Dashboard() {
  const { user: me } = useAuth();
  const isAdminTier = !!me && ADMIN_ROLES.includes(me.role);

  const [stats, setStats]   = useState({ total: 0, recent: [] });
  const [crm, setCrm]       = useState({ total: 0, due_followups: 0, converted: 0, lost: 0 });
  const [cust, setCust]     = useState({ total: 0, repeat: 0 });
  const [rem, setRem]       = useState({ overdue: 0, today: 0, upcoming: 0, due: 0 });
  const [conv, setConv]     = useState({ conversion_pct: 0, converted: 0, total: 0 });
  const [sales, setSales]   = useState([]);
  const [att, setAtt]       = useState({ present: 0, absent: 0, leave: 0, half_day: 0 });
  const [lv, setLv]         = useState({ pending_approvals: 0, leaves_today: 0 });
  const [perf, setPerf]     = useState([]);
  const [tk, setTk]         = useState({ pending: 0, overdue: 0, completed_today: 0 });
  const [inc, setInc]       = useState({ pending_count: 0, pending_total: 0, top_earners: [] });
  const [myAtt, setMyAtt]   = useState({ status: null });
  const [myInc, setMyInc]   = useState({ total: 0, pending: 0, paid: 0 });
  const [invSum, setInvSum] = useState(null);
  const [invAlerts, setInvAlerts] = useState(null);
  const [soSum, setSoSum]   = useState(null);
  const [prodAlerts, setProdAlerts] = useState(null);
  const [jwSum, setJwSum]   = useState(null);
  const [repSum, setRepSum] = useState(null);

  useEffect(() => {
    // Scoped server-side: sales-exec receives only their own figures.
    quotationsApi.list().then((r) => setStats({ total: r.length, recent: r.slice(0, 5) })).catch(() => {});
    leadsApi.stats().then(setCrm).catch(() => {});
    customersApi.stats().then(setCust).catch(() => {});
    remindersApi.dashboard().then(setRem).catch(() => {});
    leavesApi.dashboard().then(setLv).catch(() => {});
    tasksApi.dashboard().then(setTk).catch(() => {});
    if (isAdminTier) {
      // Org-wide HR + analytics — admin/super only (also gated server-side).
      attendanceApi.today().then(setAtt).catch(() => {});
      analyticsApi.conversion().then(setConv).catch(() => {});
      analyticsApi.sales().then(setSales).catch(() => {});
      analyticsApi.performance().then(setPerf).catch(() => {});
      incentivesApi.dashboard().then(setInc).catch(() => {});
      inventoryApi.summary().then(setInvSum).catch(() => {});
      inventoryApi.alerts().then(setInvAlerts).catch(() => {});
      salesOrdersApi.dashboard().then(setSoSum).catch(() => {});
      productionApi.alerts().then(setProdAlerts).catch(() => {});
      jobWorksApi.dashboard().then(setJwSum).catch(() => {});
      repairsApi.dashboard().then(setRepSum).catch(() => {});
    } else {
      // Sales-exec self-scoped HR.
      attendanceApi.myToday().then(setMyAtt).catch(() => {});
      incentivesApi.mySummary().then(setMyInc).catch(() => {});
    }
  }, [isAdminTier]);

  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 lg:mb-10">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-wider text-ink">Dashboard</h1>
          <p className="text-xs uppercase tracking-[3px] text-gold mt-2">JBOS Overview</p>
        </div>
        <Link to="/quotations/new" className="btn-primary self-start sm:self-auto">+ New Quotation</Link>
      </div>

      {isAdminTier ? (
        <>
          {/* CRM widgets (org-wide) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatCard label="Total Leads"      value={crm.total}         to="/leads" />
            <StatCard label="Due Followups"    value={crm.due_followups} to="/leads" highlight={crm.due_followups > 0} />
            <StatCard label="Converted Leads"  value={crm.converted}     to="/leads" />
            <StatCard label="Lost Leads"       value={crm.lost}          to="/leads" />
          </div>

          {/* Relationship widgets */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatCard label="Total Customers"  value={cust.total}  to="/customers" />
            <StatCard label="Repeat Customers" value={cust.repeat} to="/customers" />
            <StatCard label="Due Reminders"    value={rem.due}     to="/customers" highlight={rem.overdue > 0}
                      hint={rem.overdue > 0 ? `${rem.overdue} overdue · ${rem.today} today` : `${rem.today} today · ${rem.upcoming} upcoming`} />
            <StatCard label="Total Quotations" value={stats.total} to="/quotations" />
          </div>

          {/* HRMS widgets (team-wide) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatCard label="Present Today"     value={att.present} to="/attendance" />
            <StatCard label="Absent Today"      value={att.absent}  to="/attendance" highlight={att.absent > 0} />
            <StatCard label="On Leave Today"    value={lv.leaves_today} to="/leaves" />
            <StatCard label="Pending Approvals" value={lv.pending_approvals} to="/leaves" highlight={lv.pending_approvals > 0} />
          </div>

          {/* Tasks + incentives widgets */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatCard label="Pending Tasks"     value={tk.pending}         to="/tasks" />
            <StatCard label="Overdue Tasks"     value={tk.overdue}         to="/tasks" highlight={tk.overdue > 0} />
            <StatCard label="Completed Today"   value={tk.completed_today} to="/tasks" />
            <StatCard label="Incentive Pending" value={inr(inc.pending_total)} to="/incentives" hint={`${inc.pending_count} payout(s)`} highlight={inc.pending_count > 0} />
          </div>

          {/* Inventory widgets (org-wide) */}
          {invSum && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
              <StatCard label="In Stock"      value={invSum.by_status?.in_stock || 0} to="/inventory" />
              <StatCard label="Reserved"      value={invSum.by_status?.reserved || 0} to="/inventory" highlight={(invSum.by_status?.reserved || 0) > 0} />
              <StatCard label="Stock Value"   value={inr(invSum.stock_market_value)} to="/inventory" hint={`Cost ${inr(invSum.stock_cost_value)}`} />
              <StatCard label="Dead Stock"    value={invAlerts?.dead_stock_count || 0} to="/inventory" highlight={(invAlerts?.dead_stock_count || 0) > 0} hint={`>${invAlerts?.dead_days || 90} days unsold`} />
            </div>
          )}

          {/* Inventory alert detail */}
          {invAlerts && (invAlerts.low_stock?.length > 0 || invAlerts.fast_movers?.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="card border-l-4 border-l-red-400">
                <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">Low Stock Categories (≤ {invAlerts.low_stock_threshold})</div>
                {invAlerts.low_stock.length === 0 ? <p className="text-sm text-ink-muted">All categories well stocked.</p> : (
                  <ul className="text-sm divide-y divide-gold-light/30">
                    {invAlerts.low_stock.map((c) => (
                      <li key={c.category} className="py-1.5 flex justify-between"><span>{c.category}</span><span className="font-medium text-red-600">{c.in_stock} in stock</span></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card border-l-4 border-l-gold">
                <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">Fast Movers (30 days)</div>
                {invAlerts.fast_movers.length === 0 ? <p className="text-sm text-ink-muted">No sales recorded yet.</p> : (
                  <ul className="text-sm divide-y divide-gold-light/30">
                    {invAlerts.fast_movers.map((c) => (
                      <li key={c.category} className="py-1.5 flex justify-between"><span>{c.category}</span><span className="font-medium text-gold-dark">{c.sold_count} sold</span></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {/* Orders / production / service widgets (org-wide) */}
          {(soSum || prodAlerts || jwSum || repSum) && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6">
              <StatCard label="Active Orders"      value={soSum?.active_orders || 0} to="/sales-orders" />
              <StatCard label="Delivery Due"       value={soSum?.delivery_due || 0} to="/sales-orders" highlight={(soSum?.delivery_due || 0) > 0} hint="next 7 days" />
              <StatCard label="Delayed Production"  value={prodAlerts?.delayed_count || 0} to="/production" highlight={(prodAlerts?.delayed_count || 0) > 0} />
              <StatCard label="Repairs Pending"    value={repSum?.pending || 0} to="/repairs" highlight={(repSum?.overdue || 0) > 0} hint={repSum?.overdue ? `${repSum.overdue} overdue` : undefined} />
              <StatCard label="Job Work Pending"   value={jwSum?.pending || 0} to="/job-works" hint={jwSum?.payment_due_total ? `${inr(jwSum.payment_due_total)} due` : undefined} highlight={(jwSum?.payment_due_total || 0) > 0} />
            </div>
          )}
        </>
      ) : (
        <>
          {/* My CRM (self-scoped) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatCard label="My Leads"        value={crm.total}         to="/leads" />
            <StatCard label="My Followups"    value={crm.due_followups} to="/leads" highlight={crm.due_followups > 0} />
            <StatCard label="My Customers"    value={cust.total}        to="/customers" />
            <StatCard label="My Quotations"   value={stats.total}       to="/quotations" />
          </div>

          {/* My work */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatCard label="My Reminders"      value={rem.due}            to="/customers" highlight={rem.overdue > 0}
                      hint={rem.overdue > 0 ? `${rem.overdue} overdue · ${rem.today} today` : `${rem.today} today · ${rem.upcoming} upcoming`} />
            <StatCard label="My Pending Tasks"  value={tk.pending}         to="/tasks" />
            <StatCard label="My Overdue Tasks"  value={tk.overdue}         to="/tasks" highlight={tk.overdue > 0} />
            <StatCard label="My Completed Today" value={tk.completed_today} to="/tasks" />
          </div>

          {/* My HR (self only) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <StatCard label="My Attendance Today" value={myAtt.status ? myAtt.status.replace('_', ' ') : 'Not marked'} to="/attendance" highlight={!myAtt.status} />
            <StatCard label="My Leave Status"     value={lv.pending_approvals} to="/leaves" highlight={lv.pending_approvals > 0}
                      hint={lv.leaves_today > 0 ? 'On leave today' : 'pending request(s)'} />
            <StatCard label="My Incentives"       value={inr(myInc.total)} to="/incentives" hint={`${inr(myInc.pending)} pending · ${inr(myInc.paid)} paid`} />
          </div>
        </>
      )}

      {/* Admin KPI */}
      {isAdminTier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="card border-l-4 border-l-gold">
            <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">Conversion Rate</div>
            <div className="font-serif text-3xl text-ink">{conv.conversion_pct}%</div>
            <div className="text-xs text-ink-muted mt-1">{conv.converted} of {conv.total} leads converted</div>
          </div>
          <div className="card lg:col-span-2 p-0 overflow-hidden">
            <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">Sales Performance (per executive)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-ink-muted border-b border-gold-light/40">
                  <tr>
                    <th className="px-4 py-2 text-left">Executive</th>
                    <th className="px-4 py-2 text-right">Leads</th>
                    <th className="px-4 py-2 text-right">Quotes</th>
                    <th className="px-4 py-2 text-right">Converted</th>
                    <th className="px-4 py-2 text-right">Conv %</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-4 text-center text-ink-muted">No activity yet.</td></tr>
                  ) : sales.map((s) => (
                    <tr key={s.id} className="border-b border-gold-light/20 last:border-0">
                      <td className="px-4 py-2">{s.full_name}</td>
                      <td className="px-4 py-2 text-right">{s.leads}</td>
                      <td className="px-4 py-2 text-right">{s.quotations}</td>
                      <td className="px-4 py-2 text-right">{s.converted}</td>
                      <td className="px-4 py-2 text-right font-medium text-gold-dark">{s.conversion_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Employee Performance (HR insight) */}
      {isAdminTier && (
        <div className="card p-0 overflow-hidden mb-6">
          <div className="bg-ink text-gold px-4 py-3 text-[10px] uppercase tracking-widest">Employee Performance</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-ink-muted border-b border-gold-light/40">
                <tr>
                  <th className="px-4 py-2 text-left">Employee</th>
                  <th className="px-4 py-2 text-right">Quotes</th>
                  <th className="px-4 py-2 text-right">Leads</th>
                  <th className="px-4 py-2 text-right">Converted</th>
                  <th className="px-4 py-2 text-right">Customers</th>
                  <th className="px-4 py-2 text-right">Conv %</th>
                  <th className="px-4 py-2 text-right">Tasks ✓</th>
                  <th className="px-4 py-2 text-right">Overdue</th>
                  <th className="px-4 py-2 text-right">Reminders</th>
                  <th className="px-4 py-2 text-right">Attend %</th>
                  <th className="px-4 py-2 text-right">Leaves</th>
                  <th className="px-4 py-2 text-right">Incentive ₹</th>
                </tr>
              </thead>
              <tbody>
                {perf.length === 0 ? (
                  <tr><td colSpan="12" className="px-4 py-4 text-center text-ink-muted">No data yet.</td></tr>
                ) : perf.map((p) => (
                  <tr key={p.employee_id} className="border-b border-gold-light/20 last:border-0">
                    <td className="px-4 py-2">{p.full_name}</td>
                    <td className="px-4 py-2 text-right">{p.quotations}</td>
                    <td className="px-4 py-2 text-right">{p.leads}</td>
                    <td className="px-4 py-2 text-right">{p.converted}</td>
                    <td className="px-4 py-2 text-right">{p.customers}</td>
                    <td className="px-4 py-2 text-right font-medium text-gold-dark">{p.conversion_pct}%</td>
                    <td className="px-4 py-2 text-right">{p.tasks_completed}</td>
                    <td className={`px-4 py-2 text-right ${p.tasks_overdue > 0 ? 'text-red-600' : ''}`}>{p.tasks_overdue}</td>
                    <td className="px-4 py-2 text-right">{p.reminders_done}</td>
                    <td className="px-4 py-2 text-right">{p.attendance_pct}%</td>
                    <td className="px-4 py-2 text-right">{p.leave_count}</td>
                    <td className="px-4 py-2 text-right">{Number(p.incentive_earned || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-10">
        <GoldRateWidget />
      </div>

      <div className="card">
        <h2 className="section-title">Recent Quotations</h2>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-ink-muted">No quotations yet. Create your first one.</p>
        ) : (
          <ul className="divide-y divide-gold-light/40">
            {stats.recent.map((q) => (
              <li key={q.quote_id} className="py-3 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{q.quote_id} · {q.customer_name}</div>
                  <div className="text-xs text-ink-muted truncate">{q.product_name || '—'}</div>
                </div>
                <Link to={`/quotations/${q.quote_id}`} className="shrink-0 text-xs uppercase tracking-widest text-gold-dark hover:text-gold">View →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, to, highlight, hint }) {
  const inner = (
    <div className={`card border-l-4 ${highlight ? 'border-l-red-400' : 'border-l-gold'} ${to ? 'hover:border-gold transition' : ''}`}>
      <div className="text-[10px] uppercase tracking-[2.5px] text-gold mb-2">{label}</div>
      <div className={`font-serif text-2xl sm:text-3xl ${highlight ? 'text-red-600' : 'text-ink'}`}>{value}</div>
      {hint && <div className="text-[10px] text-ink-muted mt-1">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}
