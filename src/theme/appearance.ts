export type ColorThemeKey =
  | "default"
  | "blue"
  | "green"
  | "purple"
  | "red"
  | "orange"
  | "teal"
  | "pink"

export type TextColor = "white" | "black"

export type AppearanceConfig = {
  colorTheme: ColorThemeKey
  fontSize: number // 14 | 16 | 18
  textColor: TextColor
}

export const TEXT_COLORS: Array<{ value: TextColor; label: string; hex: string }> = [
  { value: "white", label: "Λευκό", hex: "#e5e7eb" },
  { value: "black", label: "Μαύρο", hex: "#111827" },
]

type ThemeColors = { primary: string; accent: string }

export const COLOR_THEMES: Record<
  ColorThemeKey,
  { label: string; swatch: string; dark: ThemeColors; light: ThemeColors }
> = {
  default: {
    label: "Προεπιλογή",
    swatch: "#2f55d4",
    dark: { primary: "#2f55d4", accent: "#ffc947" },
    light: { primary: "#2563eb", accent: "#3b82f6" },
  },
  blue: {
    label: "Μπλε",
    swatch: "#0ea5e9",
    dark: { primary: "#0ea5e9", accent: "#7dd3fc" },
    light: { primary: "#0284c7", accent: "#38bdf8" },
  },
  green: {
    label: "Πράσινο",
    swatch: "#16a34a",
    dark: { primary: "#16a34a", accent: "#4ade80" },
    light: { primary: "#15803d", accent: "#22c55e" },
  },
  purple: {
    label: "Μωβ",
    swatch: "#7c3aed",
    dark: { primary: "#7c3aed", accent: "#c4b5fd" },
    light: { primary: "#7c3aed", accent: "#8b5cf6" },
  },
  red: {
    label: "Κόκκινο",
    swatch: "#dc2626",
    dark: { primary: "#dc2626", accent: "#fca5a5" },
    light: { primary: "#dc2626", accent: "#f87171" },
  },
  orange: {
    label: "Πορτοκαλί",
    swatch: "#ea580c",
    dark: { primary: "#ea580c", accent: "#fb923c" },
    light: { primary: "#c2410c", accent: "#f97316" },
  },
  teal: {
    label: "Τυρκουάζ",
    swatch: "#0d9488",
    dark: { primary: "#0d9488", accent: "#5eead4" },
    light: { primary: "#0f766e", accent: "#14b8a6" },
  },
  pink: {
    label: "Ροζ",
    swatch: "#db2777",
    dark: { primary: "#db2777", accent: "#f9a8d4" },
    light: { primary: "#be185d", accent: "#ec4899" },
  },
}

export const FONT_SIZES = [
  { label: "Μικρό", value: 14 },
  { label: "Κανονικό", value: 16 },
  { label: "Μεγάλο", value: 18 },
]

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  colorTheme: "default",
  fontSize: 16,
  textColor: "white",
}

const STORAGE_KEY = "appearance_v1"

export function loadAppearance(): AppearanceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return { ...DEFAULT_APPEARANCE }
}

export function saveAppearance(config: AppearanceConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function applyAppearance(config: AppearanceConfig) {
  const isDark = !document.documentElement.classList.contains("light")
  const theme = COLOR_THEMES[config.colorTheme] ?? COLOR_THEMES.default
  const colors = isDark ? theme.dark : theme.light

  const root = document.documentElement
  root.style.setProperty("--color-primary", colors.primary)
  root.style.setProperty("--color-accent", colors.accent)
  root.style.fontSize = `${config.fontSize}px`

  // In light mode always use dark text — textColor setting only applies in dark mode
  if (isDark) {
    const textHex = config.textColor === "black" ? "#111827" : "#e5e7eb"
    const mutedHex = config.textColor === "black" ? "#4b5563" : "#94a3b8"
    root.style.setProperty("--color-text", textHex)
    root.style.setProperty("--color-muted", mutedHex)
  } else {
    root.style.setProperty("--color-text", "#111827")
    root.style.setProperty("--color-muted", "#374151")
  }
}
