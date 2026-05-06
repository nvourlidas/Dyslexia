import { useEffect, useState } from "react"
import { RotateCcw, Save } from "lucide-react"
import {
  type AppearanceConfig,
  type ColorThemeKey,
  type TextColor,
  COLOR_THEMES,
  DEFAULT_APPEARANCE,
  FONT_SIZES,
  TEXT_COLORS,
  applyAppearance,
  loadAppearance,
  saveAppearance,
} from "@/theme/appearance"

export default function ThemeSettingsPage() {
  const [config, setConfig] = useState<AppearanceConfig>(loadAppearance)
  const [dirty, setDirty] = useState(false)

  // Live preview on every change
  useEffect(() => {
    applyAppearance(config)
  }, [config])

  function update(partial: Partial<AppearanceConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }))
    setDirty(true)
  }

  function handleSave() {
    saveAppearance(config)
    setDirty(false)
  }

  function handleReset() {
    const def = { ...DEFAULT_APPEARANCE }
    setConfig(def)
    saveAppearance(def)
    applyAppearance(def)
    setDirty(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <h1 className="text-lg font-semibold">Εμφάνιση</h1>
      </div>

      {/* ── Color palette ── */}
      <div className="rounded-2xl border border-border bg-panel p-4">
        <div className="mb-1 text-base font-semibold">Χρωματική παλέτα</div>
        <div className="mb-4 text-xs text-muted">Επιλέξτε χρώμα για τα κουμπιά και τα στοιχεία της εφαρμογής</div>

        <div className="flex flex-wrap gap-4">
          {(Object.entries(COLOR_THEMES) as [ColorThemeKey, typeof COLOR_THEMES[ColorThemeKey]][]).map(
            ([key, theme]) => {
              const selected = config.colorTheme === key
              return (
                <button
                  key={key}
                  title={theme.label}
                  onClick={() => update({ colorTheme: key })}
                  className="flex flex-col items-center gap-1.5 outline-none"
                >
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-all"
                    style={{
                      background: theme.swatch,
                      boxShadow: selected
                        ? `0 0 0 3px var(--color-bg), 0 0 0 5px ${theme.swatch}`
                        : "none",
                      transform: selected ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    {selected && (
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span
                    className="text-xs transition-colors"
                    style={{ color: selected ? "var(--color-primary)" : "var(--color-muted)" }}
                  >
                    {theme.label}
                  </span>
                </button>
              )
            },
          )}
        </div>
      </div>

      {/* ── Font size ── */}
      <div className="rounded-2xl border border-border bg-panel p-4">
        <div className="mb-1 text-base font-semibold">Μέγεθος γραμματοσειράς</div>
        <div className="mb-4 text-xs text-muted">Αλλάζει το μέγεθος κειμένου σε ολόκληρη την εφαρμογή</div>

        <div className="flex gap-2">
          {FONT_SIZES.map((fs) => (
            <button
              key={fs.value}
              onClick={() => update({ fontSize: fs.value })}
              className={[
                "btn flex-1 py-2.5 text-sm transition-all",
                config.fontSize === fs.value ? "btn-primary font-semibold" : "",
              ].join(" ")}
            >
              <span style={{ fontSize: `${fs.value * 0.75}px` }}>Α</span>
              &nbsp;{fs.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Text color ── */}
      <div className="rounded-2xl border border-border bg-panel p-4">
        <div className="mb-1 text-base font-semibold">Χρώμα γραμματοσειράς</div>
        <div className="mb-4 text-xs text-muted">Λευκό για σκοτεινό θέμα, μαύρο για φωτεινό</div>
        <div className="flex gap-2">
          {TEXT_COLORS.map((tc) => {
            const selected = config.textColor === tc.value
            return (
              <button
                key={tc.value}
                onClick={() => update({ textColor: tc.value as TextColor })}
                className={[
                  "btn flex flex-1 items-center justify-center gap-2 py-2.5 text-sm transition-all",
                  selected ? "btn-primary font-semibold" : "",
                ].join(" ")}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full border border-border/30 shrink-0"
                  style={{ background: tc.hex }}
                />
                {tc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between gap-3">
        <button
          className="btn flex items-center gap-2 text-sm"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Επαναφορά αρχικών
        </button>
        <button
          className="btn btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          onClick={handleSave}
          disabled={!dirty}
        >
          <Save className="h-3.5 w-3.5" />
          {dirty ? "Αποθήκευση" : "Αποθηκεύτηκε"}
        </button>
      </div>
    </div>
  )
}
