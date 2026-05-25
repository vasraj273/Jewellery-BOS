import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/dashboard',        label: 'Dashboard' },
  { to: '/quotations/new',   label: 'Create Quotation' },
  { to: '/quotations',       label: 'Quotation History' }
];

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-ink text-white flex flex-col border-r border-gold/30">
        <div className="px-6 py-7 border-b border-gold/30">
          <div className="font-serif text-xl tracking-[3px] text-gold uppercase">JBOS</div>
          <div className="text-[10px] tracking-[2px] uppercase text-gold-light/70 mt-1">
            Jewellery Operating System
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-2 text-xs uppercase tracking-widest border-l-2 transition ${
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
        <div className="px-6 py-4 border-t border-gold/30 text-[10px] tracking-[1.5px] text-gold-light/50 uppercase">
          v1.0 · Quotation Module
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
