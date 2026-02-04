// src/layout/AppShell.tsx
import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { NAV, type NavEntry } from '../_nav'
import { ChevronDown, LogOut, Settings, User as UserIcon } from 'lucide-react'
import { getInitialTheme, toggleTheme, type ThemeMode } from '../theme/theme'
import { useAuth } from '@/auth/AuthProvider'

function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(' ')
}

function isActivePath(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(to + '/')
}

function getInitials(email?: string | null) {
  if (!email) return 'U'
  const left = email.split('@')[0] || 'u'
  const parts = left.split(/[._-]+/).filter(Boolean)
  const a = parts[0]?.[0] ?? left[0] ?? 'u'
  const b = parts[1]?.[0] ?? ''
  return (a + b).toUpperCase()
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme())
  const location = useLocation()
  const navigate = useNavigate()

  const { user, signOut } = useAuth()

  // keep groups with any active child opened by default
  const defaultOpenGroups = useMemo(() => {
    const open = new Set<string>()
    for (const entry of NAV) {
      if (entry.type === 'group') {
        const anyActive = entry.children.some((c) =>
          isActivePath(location.pathname, c.to, c.end),
        )
        if (anyActive) open.add(entry.label)
      }
    }
    return open
  }, [location.pathname])

  const [openGroups, setOpenGroups] = useState<Set<string>>(defaultOpenGroups)

  // sync open groups when route changes (so active group auto-opens)
  if (defaultOpenGroups.size && openGroups.size === 0) {
    setOpenGroups(defaultOpenGroups)
  }

  const sidebarW = collapsed ? 'w-[84px]' : 'w-[280px]'

  // ---- Profile dropdown ----
  const [profileOpen, setProfileOpen] = useState(false)
  const profileWrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!profileWrapRef.current) return
      if (!profileWrapRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false)
    }

    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  async function onLogout() {
    try {
      await signOut()
    } finally {
      setProfileOpen(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className={cx('sticky top-0 h-screen shrink-0 border-r border-border bg-panel2', sidebarW)}>
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
            {NAV.map((entry, idx) => (
              <Fragment key={`${entry.type}-${idx}`}>
                <NavBlock
                  entry={entry}
                  collapsed={collapsed}
                  openGroups={openGroups}
                  setOpenGroups={setOpenGroups}
                  pathname={location.pathname}
                />
              </Fragment>
            ))}
          </nav>
        </aside>

        {/* MAIN */}
        <div className="min-w-0 flex-1">
          {/* HEADER */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-panel/80 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">CRM</div>
              <div className="text-xs text-muted">Tenant App</div>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => setMode(toggleTheme(mode))}>
                {mode === 'dark' ? 'Φωτεινό' : 'Σκοτεινό'}
              </button>

              {/* Profile dropdown */}
              <div className="relative" ref={profileWrapRef}>
                <button
                  type="button"
                  className="btn flex items-center gap-2"
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-panel text-xs font-semibold">
                    {getInitials(user?.email)}
                  </span>
                  <span className="hidden max-w-55 truncate text-sm md:block">
                    {user?.email ?? 'Λογαριασμός'}
                  </span>
                  <ChevronDown size={16} className={cx('transition', profileOpen && 'rotate-180')} />
                </button>

                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-panel p-2 shadow-lg"
                  >
                    <div className="px-2 py-2">
                      <div className="text-sm font-semibold">Λογαριασμός</div>
                      <div className="mt-1 truncate text-xs text-muted">
                        {user?.email ?? '—'}
                      </div>
                    </div>

                    <div className="my-2 border-t border-border/60" />

                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-text hover:bg-panel2"
                      onClick={() => {
                        setProfileOpen(false)
                        navigate('/profile')
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <UserIcon size={16} />
                        Προφίλ
                      </span>
                    </button>

                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-text hover:bg-panel2"
                      onClick={() => {
                        setProfileOpen(false)
                        navigate('/themesettings')
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Settings size={16} />
                        Ρυθμίσεις
                      </span>
                    </button>

                    <div className="my-2 border-t border-border/60" />

                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-panel2"
                      style={{ color: 'var(--color-danger)' }}
                      onClick={onLogout}
                    >
                      <span className="inline-flex items-center gap-2">
                        <LogOut size={16} />
                        Αποσύνδεση
                      </span>
                    </button>
                  </div>
                )}
              </div>
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
  )
}

function NavBlock({
  entry,
  collapsed,
  openGroups,
  setOpenGroups,
  pathname,
}: {
  entry: NavEntry
  collapsed: boolean
  openGroups: Set<string>
  setOpenGroups: React.Dispatch<React.SetStateAction<Set<string>>>
  pathname: string
}) {
  if (entry.type === 'divider') {
    return <div className="my-3 border-t border-border/60" />
  }

  if (entry.type === 'section') {
    return (
      <div className={cx('mb-2 mt-4 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted', collapsed && 'text-center')}>
        {collapsed ? '•' : entry.title}
      </div>
    )
  }

  if (entry.type === 'item') {
    const Icon = entry.icon
    return (
      <NavLink
        to={entry.to}
        end={entry.end}
        className={({ isActive }) =>
          cx(
            'mb-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
            isActive ? 'border-border bg-panel text-text' : 'border-transparent text-muted hover:border-border hover:bg-panel/60 hover:text-text',
            collapsed && 'justify-center px-2',
          )
        }
        title={collapsed ? entry.label : undefined}
      >
        {Icon ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-panel">
            <Icon size={18} />
          </span>
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-panel">
            {entry.label[0]}
          </span>
        )}

        {!collapsed && <span className="truncate">{entry.label}</span>}
      </NavLink>
    )
  }

  // group
  const isOpen = openGroups.has(entry.label)
  const anyActive = entry.children.some((c) => isActivePath(pathname, c.to, c.end))
  const GroupIcon = entry.icon

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => {
          setOpenGroups((prev) => {
            const next = new Set(prev)
            if (next.has(entry.label)) next.delete(entry.label)
            else next.add(entry.label)
            return next
          })
        }}
        className={cx(
          'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
          anyActive ? 'border-border bg-panel text-text' : 'border-transparent text-muted hover:border-border hover:bg-panel/60 hover:text-text',
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? entry.label : undefined}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-panel">
          {GroupIcon ? <GroupIcon size={18} /> : entry.label[0]}
        </span>

        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{entry.label}</span>
            <ChevronDown size={16} className={cx('transition', isOpen ? 'rotate-180' : '')} />
          </>
        )}
      </button>

      {!collapsed && isOpen && (
        <div className="mt-2 grid gap-1 pl-11">
          {entry.children.map((c) => {
            const ChildIcon = c.icon
            const active = isActivePath(pathname, c.to, c.end)
            return (
              <NavLink
                key={c.to}
                to={c.to}
                end={c.end}
                className={() =>
                  cx(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                    active ? 'border-border bg-panel2 text-text' : 'border-transparent text-muted hover:border-border hover:bg-panel/60 hover:text-text',
                  )
                }
              >
                {ChildIcon ? <ChildIcon size={16} /> : <span className="opacity-60">•</span>}
                <span className="truncate">{c.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
