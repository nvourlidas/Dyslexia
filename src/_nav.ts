// src/_nav.ts
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  ContactRound,
  CalendarClock,
  Settings,
  Palette,
} from 'lucide-react'

export type NavEntry =
  | { type: 'section'; title: string }
  | { type: 'divider' }
  | { type: 'item'; label: string; to: string; end?: boolean; roles?: string[]; icon?: LucideIcon }
  | {
      type: 'group'
      label: string
      roles?: string[]
      icon?: LucideIcon
      children: Array<{ label: string; to: string; end?: boolean; roles?: string[]; icon?: LucideIcon }>
    }

export const NAV: NavEntry[] = [
  { type: 'section', title: 'Κύρια' },
  { type: 'item', label: 'Πίνακας', to: '/', end: true, icon: LayoutDashboard },
  { type: 'item', label: 'Μαθητές', to: '/students', icon: Users },
  { type: 'item', label: 'Καθηγητές', to: '/teachers', icon: ContactRound },

  { type: 'section', title: 'Διαχείριση' },
  {
    type: 'group',
    label: 'Πρόγραμμα',
    icon: CalendarClock,
    children: [
      { label: 'Συνεδρίες', to: '/sessions' },
      { label: 'Παρουσίες', to: '/attendance' },
    ],
  },

  { type: 'section', title: 'Ρυθμίσεις' },
  {
    type: 'group',
    label: 'Ρυθμίσεις',
    icon: Settings,
    children: [{ label: 'Εμφάνιση', to: '/themesettings', icon: Palette }],
  },
]
