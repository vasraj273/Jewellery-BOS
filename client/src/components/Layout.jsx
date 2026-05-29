import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const ADMIN = ['super_admin', 'admin'];

// Grouped information architecture. Each item may carry a `roles` allow-list;
// groups with no visible items are dropped for that role.
const NAV_GROUPS = [
  {
    title: 'Sales & CRM',
    items: [
      { to: '/dashboard',      label: 'Dashboard' },
      { to: '/quotations/new', label: 'Create Quotation' },
      { to: '/quotations',     label: 'Quotation History' },
      { to: '/leads',          label: 'Leads' },
      { to: '/customers',      label: 'Customers' },
      { to: '/sales-orders',   label: 'Sales Orders' }
    ]
  },
  {
    title: 'Inventory & Procurement',
    items: [
      { to: '/inventory',  label: 'Inventory' },
      { to: '/suppliers',  label: 'Suppliers', roles: ADMIN },
      { to: '/purchases',  label: 'Purchases', roles: ADMIN }
    ]
  },
  {
    title: 'Production',
    items: [
      { to: '/production', label: 'Production', roles: ADMIN },
      { to: '/job-works',  label: 'Job Work',   roles: ADMIN },
      { to: '/karigars',   label: 'Karigars',   roles: ADMIN },
      { to: '/repairs',    label: 'Repairs',    roles: ADMIN }
    ]
  },
  {
    title: 'Finance',
    items: [
      { to: '/accounts', label: 'Accounts',  roles: ADMIN },
      { to: '/payments', label: 'Payments',  roles: ADMIN },
      { to: '/expenses', label: 'Expenses',  roles: ADMIN },
      { to: '/invoices', label: 'Invoices',  roles: ADMIN }
    ]
  },
  {
    title: 'HRMS',
    items: [
      { to: '/attendance',  label: 'Attendance' },
      { to: '/leaves',      label: 'Leaves' },
      { to: '/tasks',       label: 'Tasks' },
      { to: '/employees',   label: 'Employees',   roles: ADMIN },
      { to: '/shifts',      label: 'Shifts',      roles: ADMIN },
      { to: '/incentives',  label: 'Incentives',  roles: ADMIN },
      { to: '/hr-calendar', label: 'HR Calendar', roles: ADMIN }
    ]
  },
  {
    title: 'Admin',
    items: [
      { to: '/admin/users',      label: 'Users',      roles: ADMIN },
      { to: '/admin/masters',    label: 'Masters',    roles: ADMIN },
      { to: '/admin/gold-rates', label: 'Gold Rates', roles: ADMIN },
      { to: '/admin/settings',   label: 'Settings',   roles: ADMIN }
    ]
  }
];

function groupsFor(role) {
  return NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}

const COLLAPSE_KEY = 'jbos.nav.collapsed';
function loadCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch { return new Set(); }
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const groups = groupsFor(user?.role);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function toggleGroup(title) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // Auto-close drawer on route change.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Lock body scroll while drawer open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const navTree = (
    <NavTree groups={groups} collapsed={collapsed} onToggle={toggleGroup} currentPath={location.pathname} onItemClick={() => setDrawerOpen(false)} />
  );

  return (
    <div className="min-h-screen flex lg:h-screen lg:overflow-hidden">
      {/* Desktop sidebar (lg+) — pinned, only nav column scrolls */}
      <aside className="hidden lg:flex w-64 bg-ink text-white flex-col border-r border-gold/30 shrink-0 lg:h-screen lg:overflow-y-auto">
        <SidebarBrand />
        <div className="flex-1 px-3 py-4">{navTree}</div>
        <SidebarFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar (< lg) */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-ink text-white border-b border-gold/30 flex items-center justify-between px-4 h-14">
        <button aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="p-2 -ml-2 text-gold hover:opacity-80"><HamburgerIcon /></button>
        <div className="font-serif text-base tracking-[3px] text-gold uppercase">JBOS</div>
        <div className="w-8" />
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      {/* Drawer panel */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] bg-ink text-white flex flex-col border-r border-gold/30 transform transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between">
          <SidebarBrand />
          <button aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="m-4 text-gold hover:opacity-80"><CloseIcon /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">{navTree}</div>
        <SidebarFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* Main — only scroll container on lg+ */}
      <main className="flex-1 min-w-0 overflow-x-hidden lg:overflow-y-auto lg:h-screen">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10 pt-20 lg:pt-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavTree({ groups, collapsed, onToggle, currentPath, onItemClick }) {
  return (
    <nav className="space-y-1">
      {groups.map((g) => {
        const hasActive = g.items.some((i) => currentPath === i.to || currentPath.startsWith(i.to + '/'));
        const isOpen = !collapsed.has(g.title) || hasActive;
        return (
          <div key={g.title} className="mb-1">
            <button
              onClick={() => onToggle(g.title)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[2px] text-gold-light/60 hover:text-gold transition"
            >
              <span>{g.title}</span>
              <ChevronIcon open={isOpen} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    `block px-3 py-2 text-xs uppercase tracking-widest border-l-2 rounded-r transition ${
                      isActive ? 'border-gold text-gold bg-white/5' : 'border-transparent text-white/70 hover:text-gold hover:border-gold-light hover:bg-white/[0.03]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="px-6 py-7 border-b border-gold/30">
      <div className="font-serif text-xl tracking-[3px] text-gold uppercase">JBOS</div>
      <div className="text-[10px] tracking-[2px] uppercase text-gold-light/70 mt-1">Jewellery Operating System</div>
    </div>
  );
}

function SidebarFooter({ user, onLogout }) {
  return (
    <div className="px-6 py-4 border-t border-gold/30 space-y-3">
      {user && (
        <div className="space-y-1">
          <div className="text-[9px] tracking-[2px] uppercase text-gold-light/50">Signed in as</div>
          <div className="text-sm text-white truncate">{user.full_name || user.email}</div>
          <div className="text-[10px] tracking-[1.5px] uppercase text-gold/80">{prettyRole(user.role)}</div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] tracking-[1.5px] uppercase text-gold-light/40">v1.0</span>
        {user && <button onClick={onLogout} className="text-[10px] tracking-[2px] uppercase text-gold hover:text-gold-light">Sign out</button>}
      </div>
    </div>
  );
}

function prettyRole(role) { return role ? role.replace(/_/g, ' ') : ''; }

function ChevronIcon({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}
