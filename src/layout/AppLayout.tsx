import { NavLink, Outlet } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { getInitialTheme, toggleTheme, type ThemeMode } from '../theme/theme';

const linkBase =
  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition border border-transparent';
const linkIdle = 'text-muted hover:text-text hover:bg-panel/60 hover:border-border';
const linkActive = 'text-text bg-panel border-border';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme());

  const sidebarW = useMemo(() => (collapsed ? 'w-[84px]' : 'w-[260px]'), [collapsed]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside
          className={[
            'sticky top-0 h-screen shrink-0 border-r border-border bg-panel2',
            sidebarW,
          ].join(' ')}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <div className="font-semibold tracking-wide">
              {collapsed ? 'CRM' : 'CRM Web'}
            </div>

            <button
              className="rounded-lg border border-border bg-panel px-2 py-1 text-xs hover:opacity-90"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              {collapsed ? '→' : '←'}
            </button>
          </div>

          <nav className="px-3 pb-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-panel">
                D
              </span>
              {!collapsed && <span>Dashboard</span>}
            </NavLink>

            <NavLink
              to="/students"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-panel">
                S
              </span>
              {!collapsed && <span>Students</span>}
            </NavLink>

            <NavLink
              to="/teachers"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-panel">
                T
              </span>
              {!collapsed && <span>Teachers</span>}
            </NavLink>
          </nav>
        </aside>

        {/* MAIN */}
        <div className="min-w-0 flex-1">
          {/* HEADER */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-panel/80 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">Welcome</div>
              <div className="text-xs text-muted">Tenant CRM</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-border bg-panel2 px-3 py-2 text-sm hover:opacity-90"
                onClick={() => setMode(toggleTheme(mode))}
              >
                {mode === 'dark' ? 'Light' : 'Dark'}
              </button>

              <button className="rounded-lg border border-border bg-panel2 px-3 py-2 text-sm hover:opacity-90">
                Profile
              </button>

              <button className="rounded-lg border border-border bg-panel2 px-3 py-2 text-sm hover:opacity-90">
                Logout
              </button>
            </div>
          </header>

          {/* CONTENT */}
          <main className="p-4">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
