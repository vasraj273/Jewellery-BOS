import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const BASE_NAV = [
  { to: '/dashboard',        label: 'Dashboard' },
  { to: '/quotations/new',   label: 'Create Quotation' },
  { to: '/quotations',       label: 'Quotation History' },
  { to: '/leads',            label: 'Leads' }
];

const ADMIN_NAV = [
  { to: '/admin/users',      label: 'Users',       roles: ['super_admin', 'admin'] },
  { to: '/admin/settings',   label: 'Settings',    roles: ['super_admin', 'admin'] },
  { to: '/admin/masters',    label: 'Masters',     roles: ['super_admin', 'admin'] },
  { to: '/admin/gold-rates', label: 'Gold Rates',  roles: ['super_admin', 'admin'] }
];

function navFor(role) {
  return [
    ...BASE_NAV,
    ...ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(role))
  ];
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  // Auto-close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Lock body scroll while drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    // On lg+ the layout pins to the viewport: sidebar stays fixed, only <main>
    // scrolls. On smaller screens the natural document scroll is preserved
    // (top bar is already position:fixed).
    <div className="min-h-screen flex lg:h-screen lg:overflow-hidden">

      {/* ─── Desktop sidebar (lg+) ───
          Sticky so the navigation + Sign Out stay pinned while the main
          content area scrolls. Inner column owns its own scroll for the
          (rare) case where nav exceeds viewport height. */}
      <aside className="hidden lg:flex w-64 bg-ink text-white flex-col border-r border-gold/30 shrink-0 lg:h-screen lg:overflow-y-auto">
        <SidebarBrand />
        <Nav items={navFor(user?.role)} className="px-4 py-6 space-y-1 flex-1" />
        <SidebarFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* ─── Mobile top bar (< lg) ─── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-ink text-white border-b border-gold/30 flex items-center justify-between px-4 h-14">
        <button
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="p-2 -ml-2 text-gold hover:opacity-80"
        >
          <HamburgerIcon />
        </button>
        <div className="font-serif text-base tracking-[3px] text-gold uppercase">JBOS</div>
        <div className="w-8" /> {/* spacer to balance the hamburger */}
      </div>

      {/* ─── Drawer overlay ─── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── Drawer panel ─── */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] bg-ink text-white flex flex-col border-r border-gold/30 transform transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-start justify-between">
          <SidebarBrand />
          <button
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="m-4 text-gold hover:opacity-80"
          >
            <CloseIcon />
          </button>
        </div>
        <Nav items={navFor(user?.role)} className="px-4 py-4 space-y-1 flex-1" onItemClick={() => setDrawerOpen(false)} />
        <SidebarFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* ─── Main ───
          On lg+ this is the only scroll container (parent is overflow-hidden
          with h-screen), so the sidebar stays pinned. On smaller screens the
          page scrolls normally; the mobile top bar is fixed. */}
      <main className="flex-1 min-w-0 overflow-x-hidden lg:overflow-y-auto lg:h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 pt-20 lg:pt-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarBrand() {
  return (
    <div className="px-6 py-7 border-b border-gold/30">
      <div className="font-serif text-xl tracking-[3px] text-gold uppercase">JBOS</div>
      <div className="text-[10px] tracking-[2px] uppercase text-gold-light/70 mt-1">
        Jewellery Operating System
      </div>
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
        {user && (
          <button
            onClick={onLogout}
            className="text-[10px] tracking-[2px] uppercase text-gold hover:text-gold-light"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function prettyRole(role) {
  if (!role) return '';
  return role.replace(/_/g, ' ');
}

function Nav({ items = [], className = '', onItemClick }) {
  return (
    <nav className={className}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          onClick={onItemClick}
          className={({ isActive }) =>
            `block px-4 py-2.5 text-xs uppercase tracking-widest border-l-2 transition ${
              isActive
                ? 'border-gold text-gold bg-white/5'
                : 'border-transparent text-white/70 hover:text-gold hover:border-gold-light'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6"  y1="6"  x2="18" y2="18" />
      <line x1="6"  y1="18" x2="18" y2="6" />
    </svg>
  );
}
