import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/auth/AuthProvider"
import { fmtDate } from "@/lib/dateUtils"
import {
  ChevronDown, ChevronRight, Check, CheckCircle2, Hash,
  Loader2, MessageSquare, Trash2,
} from "lucide-react"

const GREEK_MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
]

// ─── Types ────────────────────────────────────────────────────────────────────

type ParaRow = {
  id: string
  title: string
  code: string | null
  code_diagnosis: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  student_name: string
  amka: string | null
}

type DocRow = {
  id: string
  start_date: string | null
  end_date: string | null
  notes: string | null
  student_name: string
  amka: string | null
  code_diagnosis: string | null
}

type MonthGroup<T> = { key: string; label: string; items: T[] }

type ConfirmState = {
  message: string
  onConfirm: () => Promise<void>
} | null

type EditState = { id: string; type: "note" | "code"; text: string } | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByMonth<T extends { end_date: string | null }>(items: T[]): MonthGroup<T>[] {
  const dated = items.filter((i) => i.end_date)
  const undated = items.filter((i) => !i.end_date)
  const map = new Map<string, T[]>()
  for (const item of dated) {
    const d = new Date(item.end_date!)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  const groups: MonthGroup<T>[] = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupItems]) => {
      const [y, m] = key.split("-").map(Number)
      return { key, label: `${GREEK_MONTHS[m]} ${y}`, items: groupItems }
    })
  if (undated.length > 0)
    groups.push({ key: "nodate", label: "Χωρίς ημερομηνία λήξης", items: undated })
  return groups
}

function mapPara(data: any[]): ParaRow[] {
  return data.map((p) => ({
    id: p.id,
    title: p.title,
    code: p.code ?? null,
    code_diagnosis: p.code_diagnosis ?? null,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,
    notes: p.notes ?? null,
    amka: p.student?.amka ?? null,
    student_name: p.student ? `${p.student.name} ${p.student.lastname}`.trim() : "(Άγνωστος)",
  }))
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, subtitle, count, loading, collapsed, onToggle, children,
}: {
  title: string
  subtitle?: string
  count: number
  loading: boolean
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {collapsed
          ? <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted" />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
        </div>
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
          : (
            <span className={[
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              count > 0 ? "bg-primary/15 text-primary" : "bg-border/20 text-muted",
            ].join(" ")}>
              {count}
            </span>
          )}
      </button>
      {!collapsed && (
        <div className="border-t border-border/50 p-4">{children}</div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PendingPage() {
  const { profile } = useAuth()
  const tenantId = profile?.tenant_id ?? null

  const [expiring, setExpiring] = useState<ParaRow[]>([])
  const [noCode, setNoCode] = useState<ParaRow[]>([])
  const [execution, setExecution] = useState<ParaRow[]>([])
  const [docOpinion, setDocOpinion] = useState<DocRow[]>([])

  const [loadingExpiring, setLoadingExpiring] = useState(false)
  const [loadingNoCode, setLoadingNoCode] = useState(false)
  const [loadingExecution, setLoadingExecution] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(false)

  const [collapsed, setCollapsed] = useState({
    expiring: false,
    noCode: false,
    execution: false,
    doc: false,
  })

  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [confirming, setConfirming] = useState(false)

  const [editState, setEditState] = useState<EditState>(null)
  const [saving, setSaving] = useState(false)

  function toggleSection(key: keyof typeof collapsed) {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }))
  }

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return
    loadExpiring(tenantId)
    loadNoCode(tenantId)
    loadExecution(tenantId)
    loadDoc()
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadExpiring(tid: string) {
    setLoadingExpiring(true)
    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from("parapemtiko")
      .select("id, title, code, code_diagnosis, start_date, end_date, notes, student:students(name, lastname, amka)")
      .eq("tenant_id", tid)
      .eq("status", "pending")
      .not("end_date", "is", null)
      .gte("end_date", today)
      .lte("end_date", in30)
      .order("end_date", { ascending: true })
    setExpiring(mapPara(data ?? []))
    setLoadingExpiring(false)
  }

  async function loadNoCode(tid: string) {
    setLoadingNoCode(true)
    const { data } = await supabase
      .from("parapemtiko")
      .select("id, title, code, code_diagnosis, start_date, end_date, notes, student:students(name, lastname, amka)")
      .eq("tenant_id", tid)
      .eq("status", "pending")
      .or("code.is.null,code.eq.")
      .order("end_date", { ascending: true, nullsFirst: false })
    setNoCode(mapPara(data ?? []))
    setLoadingNoCode(false)
  }

  async function loadExecution(tid: string) {
    setLoadingExecution(true)
    const { data } = await supabase
      .from("parapemtiko")
      .select("id, title, code, code_diagnosis, start_date, end_date, notes, student:students(name, lastname, amka)")
      .eq("tenant_id", tid)
      .eq("status", "pending")
      .order("end_date", { ascending: true, nullsFirst: false })
    setExecution(mapPara(data ?? []))
    setLoadingExecution(false)
  }

  async function loadDoc() {
    setLoadingDoc(true)
    const today = new Date()
    const in4m = new Date(today.getFullYear(), today.getMonth() + 4, today.getDate())
    const { data } = await supabase
      .from("doc_opinion")
      .select("id, start_date, end_date, notes, student:students(name, lastname, amka), parapemptika:parapemtiko(code_diagnosis)")
      .eq("status", "pending")
      .not("end_date", "is", null)
      .gte("end_date", today.toISOString().slice(0, 10))
      .lte("end_date", in4m.toISOString().slice(0, 10))
      .order("end_date", { ascending: true })
    const rows: DocRow[] = (data ?? []).map((d: any) => ({
      id: d.id,
      start_date: d.start_date ?? null,
      end_date: d.end_date ?? null,
      notes: d.notes ?? null,
      amka: d.student?.amka ?? null,
      student_name: d.student ? `${d.student.name} ${d.student.lastname}`.trim() : "(Άγνωστος)",
      code_diagnosis: (d.parapemptika ?? []).map((p: any) => p.code_diagnosis).filter(Boolean).join(", ") || null,
    }))
    setDocOpinion(rows)
    setLoadingDoc(false)
  }

  // ─── Confirm + remove ──────────────────────────────────────────────────────

  async function runConfirm() {
    if (!confirm) return
    setConfirming(true)
    await confirm.onConfirm()
    setConfirm(null)
    setConfirming(false)
  }

  function removePara(id: string, from: "expiring" | "noCode" | "execution") {
    setConfirm({
      message: "Αφαίρεση παραπεμπτικού; Το status θα αλλάξει σε completed.",
      onConfirm: async () => {
        await supabase.from("parapemtiko").update({ status: "completed" }).eq("id", id)
        if (from === "expiring") setExpiring((p) => p.filter((i) => i.id !== id))
        else if (from === "noCode") setNoCode((p) => p.filter((i) => i.id !== id))
        else setExecution((p) => p.filter((i) => i.id !== id))
        if (editState?.id === id) setEditState(null)
      },
    })
  }

  async function completePara(id: string) {
    await supabase.from("parapemtiko").update({ status: "completed" }).eq("id", id)
    setExecution((p) => p.filter((i) => i.id !== id))
    setExpiring((p) => p.filter((i) => i.id !== id))
    if (editState?.id === id) setEditState(null)
  }

  function removeDoc(id: string) {
    setConfirm({
      message: "Αφαίρεση γνωμάτευσης; Το status θα αλλάξει σε completed.",
      onConfirm: async () => {
        await supabase.from("doc_opinion").update({ status: "completed" }).eq("id", id)
        setDocOpinion((p) => p.filter((i) => i.id !== id))
        if (editState?.id === id) setEditState(null)
      },
    })
  }

  // ─── Note / code edit ──────────────────────────────────────────────────────

  function startEdit(id: string, type: "note" | "code", text: string) {
    setEditState({ id, type, text })
  }

  async function saveEdit() {
    if (!editState) return
    setSaving(true)
    const { id, type, text } = editState

    if (type === "note") {
      const { error } = await supabase.from("parapemtiko").update({ notes: text || null }).eq("id", id)
      if (!error) {
        const upd = (p: ParaRow[]) => p.map((i) => (i.id === id ? { ...i, notes: text || null } : i))
        setExpiring(upd)
        setNoCode(upd)
        setExecution(upd)
        setEditState(null)
      }
    } else {
      const trimmed = text.trim()
      const { error } = await supabase.from("parapemtiko").update({ code: trimmed || null }).eq("id", id)
      if (!error && trimmed) {
        setNoCode((p) => p.filter((i) => i.id !== id))
        setExecution((p) => p.map((i) => (i.id === id ? { ...i, code: trimmed } : i)))
        setEditState(null)
      }
    }
    setSaving(false)
  }

  // ─── Month groups ──────────────────────────────────────────────────────────

  const expiringGroups = useMemo(() => groupByMonth(expiring), [expiring])
  const noCodeGroups = useMemo(() => groupByMonth(noCode), [noCode])
  const executionGroups = useMemo(() => groupByMonth(execution), [execution])
  const docGroups = useMemo(() => groupByMonth(docOpinion), [docOpinion])

  // ─── Render helpers ────────────────────────────────────────────────────────

  function renderParaCard(
    item: ParaRow,
    opts: { showCode?: boolean; showComplete?: boolean; from: "expiring" | "noCode" | "execution" }
  ) {
    const isEditing = editState?.id === item.id
    return (
      <div
        key={item.id}
        className={[
          "rounded-xl border px-3 py-2.5",
          isEditing ? "border-primary/20 bg-primary/5" : "border-border bg-bg",
        ].join(" ")}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">{item.student_name}</span>
              {item.code && (
                <span className="rounded bg-border/20 px-1.5 py-0.5 text-xs font-mono text-muted">
                  {item.code}
                </span>
              )}
            </div>
            <div className="text-xs font-medium text-muted">{item.title}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
              {item.amka && <span>ΑΜΚΑ: <span className="font-mono">{item.amka}</span></span>}
              {item.code_diagnosis && <span>Κωδ. Διάγν.: <span className="font-mono">{item.code_diagnosis}</span></span>}
              {item.end_date && <span>Λήξη: {fmtDate(item.end_date)}</span>}
            </div>
            {!isEditing && item.notes && (
              <div className="mt-1 rounded-lg bg-panel/60 px-2 py-1 text-xs text-muted">
                <span className="font-medium">Σημ.:</span> {item.notes}
              </div>
            )}
          </div>
          {!isEditing && (
            <div className="flex shrink-0 gap-1">
              {opts.showCode && (
                <button
                  onClick={() => startEdit(item.id, "code", item.code ?? "")}
                  title="Συμπλήρωση κωδικού γονέα"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border/30 text-muted hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Hash className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => startEdit(item.id, "note", item.notes ?? "")}
                title={item.notes ? "Επεξεργασία σημείωσης" : "Προσθήκη σημείωσης"}
                className={[
                  "inline-flex h-6 w-6 items-center justify-center rounded-lg border transition-colors",
                  item.notes
                    ? "border-primary/30 text-primary hover:bg-primary/10"
                    : "border-border/30 text-muted hover:border-border/60 hover:text-text",
                ].join(" ")}
              >
                <MessageSquare className="h-3 w-3" />
              </button>
              {opts.showComplete && (
                <button
                  onClick={() => completePara(item.id)}
                  title="Εκτελέστηκε"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                >
                  <CheckCircle2 className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => removePara(item.id, opts.from)}
                title="Αφαίρεση"
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="mt-2.5 space-y-1.5 border-t border-border/20 pt-2.5">
            {editState?.type === "code" ? (
              <input
                autoFocus
                className="input text-sm"
                placeholder="Κωδικός γονέα..."
                value={editState.text}
                onChange={(e) => setEditState((p) => p ? { ...p, text: e.target.value } : p)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
            ) : (
              <textarea
                autoFocus
                className="input h-16 resize-none py-1.5 text-xs"
                placeholder="Σημείωση / σχόλιο..."
                value={editState!.text}
                onChange={(e) => setEditState((p) => p ? { ...p, text: e.target.value } : p)}
              />
            )}
            <div className="flex gap-1.5">
              <button
                className="btn btn-primary flex items-center gap-1 text-xs"
                disabled={saving || (editState?.type === "code" && !editState.text.trim())}
                onClick={saveEdit}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Αποθήκευση
              </button>
              <button className="btn text-xs" disabled={saving} onClick={() => setEditState(null)}>
                Ακύρωση
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderGroups<T extends { end_date: string | null; id: string }>(
    groups: MonthGroup<T>[],
    renderItem: (item: T) => React.ReactNode,
    emptyMsg: string
  ) {
    if (groups.length === 0 || groups.every((g) => g.items.length === 0)) {
      return <div className="py-6 text-center text-sm text-muted">{emptyMsg}</div>
    }
    return (
      <div className="space-y-4">
        {groups.map((group) => group.items.length > 0 && (
          <div key={group.key}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</span>
              <span className="text-xs text-muted">({group.items.length})</span>
            </div>
            <div className="space-y-1.5">{group.items.map(renderItem)}</div>
          </div>
        ))}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <h1 className="text-lg font-semibold">Εκκρεμότητες</h1>
        <span className="text-sm text-muted">— Αναλυτική επισκόπηση εκκρεμών ενεργειών</span>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Λήξη 30 μέρες", count: expiring.length, loading: loadingExpiring },
          { label: "Χωρίς κωδικό", count: noCode.length, loading: loadingNoCode },
          { label: "Προς εκτέλεση", count: execution.length, loading: loadingExecution },
          { label: "Γνωματεύσεις", count: docOpinion.length, loading: loadingDoc },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-border bg-panel px-4 py-3">
            <div className="text-xs text-muted">{kpi.label}</div>
            <div className="mt-1 text-xl font-semibold">
              {kpi.loading ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : kpi.count}
            </div>
          </div>
        ))}
      </div>

      {/* Section 1: Expiring 30 days */}
      <Section
        title="Παραπεμπτικά προς λήξη (30 μέρες)"
        subtitle="Pending παραπεμπτικά που λήγουν εντός 30 ημερών"
        count={expiring.length}
        loading={loadingExpiring}
        collapsed={collapsed.expiring}
        onToggle={() => toggleSection("expiring")}
      >
        {loadingExpiring
          ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          : renderGroups(
              expiringGroups,
              (item) => renderParaCard(item, { from: "expiring" }),
              "Κανένα παραπεμπτικό δεν λήγει εντός 30 ημερών."
            )
        }
      </Section>

      {/* Section 2: No code */}
      <Section
        title="Παραπεμπτικά χωρίς κωδικό γονέα"
        subtitle="Παραπεμπτικά χωρίς συμπληρωμένο κωδικό γονέα"
        count={noCode.length}
        loading={loadingNoCode}
        collapsed={collapsed.noCode}
        onToggle={() => toggleSection("noCode")}
      >
        {loadingNoCode
          ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          : renderGroups(
              noCodeGroups,
              (item) => renderParaCard(item, { showCode: true, from: "noCode" }),
              "Όλα τα παραπεμπτικά έχουν κωδικό γονέα."
            )
        }
      </Section>

      {/* Section 3: Execution */}
      <Section
        title="Εκτέλεση Παραπεμπτικών"
        subtitle="Όλα τα pending παραπεμπτικά ανά μήνα λήξης"
        count={execution.length}
        loading={loadingExecution}
        collapsed={collapsed.execution}
        onToggle={() => toggleSection("execution")}
      >
        {loadingExecution
          ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          : renderGroups(
              executionGroups,
              (item) => renderParaCard(item, { showComplete: true, from: "execution" }),
              "Δεν υπάρχουν παραπεμπτικά προς εκτέλεση."
            )
        }
      </Section>

      {/* Section 4: Doc opinions */}
      <Section
        title="Γνωματεύσεις προς αποστολή"
        subtitle="Pending γνωματεύσεις που λήγουν εντός 4 μηνών"
        count={docOpinion.length}
        loading={loadingDoc}
        collapsed={collapsed.doc}
        onToggle={() => toggleSection("doc")}
      >
        {loadingDoc
          ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          : renderGroups(
              docGroups,
              (item) => (
                <div key={item.id} className="rounded-xl border border-border bg-bg px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-sm font-medium">{item.student_name}</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        {item.amka && <span>ΑΜΚΑ: <span className="font-mono">{item.amka}</span></span>}
                        {item.code_diagnosis && <span>Κωδ. Διάγν.: <span className="font-mono">{item.code_diagnosis}</span></span>}
                        {item.end_date && <span>Λήξη: {fmtDate(item.end_date)}</span>}
                      </div>
                      {item.notes && (
                        <div className="mt-1 rounded-lg bg-panel/60 px-2 py-1 text-xs text-muted">
                          <span className="font-medium">Σημ.:</span> {item.notes}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeDoc(item.id)}
                      title="Αφαίρεση"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ),
              "Δεν υπάρχουν γνωματεύσεις προς αποστολή."
            )
        }
      </Section>

      {/* Shared confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-5 shadow-xl">
            <div className="font-semibold">Επιβεβαίωση αφαίρεσης</div>
            <div className="mt-2 text-sm text-muted">{confirm.message}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn text-xs" disabled={confirming} onClick={() => setConfirm(null)}>
                Ακύρωση
              </button>
              <button className="btn btn-danger text-xs" disabled={confirming} onClick={runConfirm}>
                {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Αφαίρεση"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
