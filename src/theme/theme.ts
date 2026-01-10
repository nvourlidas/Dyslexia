const THEME_KEY = 'crm_theme'
export type ThemeMode = 'dark' | 'light'

export function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark' // default
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'light') root.classList.add('light')
  else root.classList.remove('light')
  localStorage.setItem(THEME_KEY, mode)
}

export function toggleTheme(current: ThemeMode): ThemeMode {
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
