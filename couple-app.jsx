import { useState, useEffect, useCallback } from "react";

// ── Palette ──────────────────────────────────────────────
const C = {
  bg:       "#0d0d14",
  surface:  "#13131f",
  card:     "#1a1a2b",
  border:   "#252538",
  accent:   "#a78bfa",   // soft violet
  accent2:  "#f472b6",   // rose (her)
  accent3:  "#60a5fa",   // blue (him)
  success:  "#34d399",
  warn:     "#fbbf24",
  danger:   "#f87171",
  text:     "#e2e0f0",
  muted:    "#6b6888",
  faint:    "#2a2a40",
};

// ── Helpers ───────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

const CATS = ["🍕 Еда", "🚗 Транспорт", "🏠 Жильё", "👗 Одежда", "💊 Здоровье", "🎮 Развлечения", "✈️ Путешествия", "💡 Коммуналка", "🎁 Подарки", "📦 Прочее"];

// ── Storage helpers ───────────────────────────────────────
const STORE_KEY = "couple-app-v1";
async function loadState() {
  try {
    const r = await window.storage.get(STORE_KEY, true);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function saveState(state) {
  try {
    await window.storage.set(STORE_KEY, JSON.stringify(state), true);
  } catch (e) { console.error(e); }
}

// ── Initial state ─────────────────────────────────────────
const INIT = {
  budget: 0,
  expenses: [],
  goals: [],
};

// ── Tiny components ───────────────────────────────────────
const Pill = ({ children, color = C.accent, onClick, active }) => (
  <button onClick={onClick} style={{
    background: active ? color : "transparent",
    border: `1.5px solid ${active ? color : C.border}`,
    color: active ? "#fff" : C.muted,
    borderRadius: 20, padding: "5px 14px", fontSize: 13,
    cursor: "pointer", transition: "all .15s", whiteSpace: "nowrap",
  }}>{children}</button>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, ...style }}>
    {children}
  </div>
);

const Input = ({ style = {}, ...props }) => (
  <input style={{
    background: C.faint, border: `1.5px solid ${C.border}`,
    borderRadius: 10, padding: "9px 12px", color: C.text,
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
    ...style,
  }} {...props} />
);

const Select = ({ children, style = {}, ...props }) => (
  <select style={{
    background: C.faint, border: `1.5px solid ${C.border}`,
    borderRadius: 10, padding: "9px 12px", color: C.text,
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
    ...style,
  }} {...props}>{children}</select>
);

const Btn = ({ children, color = C.accent, ghost, style = {}, ...props }) => (
  <button style={{
    background: ghost ? "transparent" : color,
    border: `1.5px solid ${color}`,
    color: ghost ? color : "#fff",
    borderRadius: 10, padding: "9px 18px", fontSize: 14,
    cursor: "pointer", fontWeight: 600, transition: "opacity .15s",
    ...style,
  }} {...props}>{children}</button>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
    {children}
  </div>
);

const ProgressBar = ({ value, max, color = C.accent }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: C.faint, borderRadius: 99, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 99, transition: "width .4s" }} />
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────
let _setToast;
const toast = (msg) => _setToast && _setToast(msg);

// ══════════════════════════════════════════════════════════
//  BUDGET TAB
// ══════════════════════════════════════════════════════════
function BudgetTab({ state, setState }) {
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(CATS[0]);
  const [note, setNote] = useState("");
  const [who, setWho] = useState("Я");
  const [filterCat, setFilterCat] = useState("Все");
  const [editBudget, setEditBudget] = useState(false);
  const [newBudget, setNewBudget] = useState("");

  const expenses = state.expenses || [];
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = (state.budget || 0) - totalSpent;

  const addExpense = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    const e = { id: uid(), amount: n, cat, note, who, date: today() };
    setState(s => ({ ...s, expenses: [e, ...s.expenses] }));
    setAmount(""); setNote("");
    toast("Расход добавлен ✓");
  };

  const del = (id) => setState(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) }));

  const saveBudget = () => {
    const n = parseFloat(newBudget);
    if (!n) return;
    setState(s => ({ ...s, budget: n }));
    setEditBudget(false);
    toast("Бюджет обновлён ✓");
  };

  const filtered = filterCat === "Все" ? expenses : expenses.filter(e => e.cat === filterCat);

  // spending by category
  const byCat = {};
  expenses.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const budgetPct = state.budget > 0 ? Math.min(100, (totalSpent / state.budget) * 100) : 0;
  const barColor = budgetPct > 90 ? C.danger : budgetPct > 65 ? C.warn : C.success;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Budget overview */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <Label>Общий бюджет</Label>
            {editBudget ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input value={newBudget} onChange={e => setNewBudget(e.target.value)}
                  placeholder="50000" type="number" style={{ width: 140 }} />
                <Btn onClick={saveBudget} style={{ padding: "8px 14px" }}>✓</Btn>
                <Btn ghost onClick={() => setEditBudget(false)} style={{ padding: "8px 14px" }}>✕</Btn>
              </div>
            ) : (
              <div style={{ fontSize: 28, fontWeight: 800, color: C.text, cursor: "pointer" }}
                onClick={() => { setNewBudget(state.budget || ""); setEditBudget(true); }}>
                {state.budget ? fmt(state.budget) : <span style={{ color: C.muted, fontSize: 16 }}>Нажмите, чтобы задать</span>}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <Label>Остаток</Label>
            <div style={{ fontSize: 22, fontWeight: 700, color: remaining >= 0 ? C.success : C.danger }}>
              {fmt(remaining)}
            </div>
          </div>
        </div>
        <ProgressBar value={totalSpent} max={state.budget || 1} color={barColor} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Потрачено: {fmt(totalSpent)}</span>
          <span style={{ fontSize: 12, color: C.muted }}>{Math.round(budgetPct)}%</span>
        </div>
      </Card>

      {/* Top categories */}
      {topCats.length > 0 && (
        <Card>
          <Label>Топ расходов</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topCats.map(([c, v]) => (
              <div key={c}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: C.text }}>{c}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{fmt(v)}</span>
                </div>
                <ProgressBar value={v} max={totalSpent} color={C.accent} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add expense */}
      <Card>
        <Label>Добавить расход</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Сумма ₽</div>
            <Input value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="1500" type="number"
              onKeyDown={e => e.key === "Enter" && addExpense()} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Кто тратил</div>
            <Select value={who} onChange={e => setWho(e.target.value)}>
              <option>Я</option>
              <option>Она</option>
              <option>Вместе</option>
            </Select>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Категория</div>
          <Select value={cat} onChange={e => setCat(e.target.value)}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Заметка (необяз.)</div>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Кафе на Арбате" />
        </div>
        <Btn onClick={addExpense} style={{ width: "100%" }}>+ Добавить</Btn>
      </Card>

      {/* Expense list */}
      {expenses.length > 0 && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Label>История</Label>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {["Все", ...CATS].map(c => (
              <Pill key={c} active={filterCat === c} onClick={() => setFilterCat(c)}
                color={C.accent}>{c.split(" ")[0] || c}</Pill>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.slice(0, 20).map(e => (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: C.faint, borderRadius: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{e.cat.split(" ")[0]}</span>
                  <div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{e.cat.split(" ").slice(1).join(" ")}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{e.note || e.date} · {e.who}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>−{fmt(e.amount)}</span>
                  <button onClick={() => del(e.id)} style={{
                    background: "none", border: "none", color: C.muted,
                    cursor: "pointer", fontSize: 16, lineHeight: 1,
                  }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  GOALS TAB
// ══════════════════════════════════════════════════════════
function GoalsTab({ state, setState }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [addAmt, setAddAmt] = useState({});

  const goals = state.goals || [];

  const addGoal = () => {
    if (!name || !target) return;
    const g = { id: uid(), name, target: parseFloat(target), saved: 0, emoji, created: today() };
    setState(s => ({ ...s, goals: [...s.goals, g] }));
    setName(""); setTarget(""); setEmoji("🎯");
    toast("Цель создана 🎯");
  };

  const contribute = (id) => {
    const n = parseFloat(addAmt[id]);
    if (!n || n <= 0) return;
    setState(s => ({
      ...s,
      goals: s.goals.map(g => g.id === id ? { ...g, saved: Math.min(g.target, g.saved + n) } : g),
    }));
    setAddAmt(a => ({ ...a, [id]: "" }));
    toast("Накопления обновлены ✓");
  };

  const delGoal = (id) => setState(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) }));

  const EMOJIS = ["🎯","✈️","🏠","🚗","💍","📱","🎮","🐕","👶","🌴","💻","🎸"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      {goals.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card style={{ padding: 16 }}>
            <Label>Целей</Label>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{goals.length}</div>
          </Card>
          <Card style={{ padding: 16 }}>
            <Label>Накоплено</Label>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.success }}>
              {fmt(goals.reduce((s, g) => s + g.saved, 0))}
            </div>
          </Card>
        </div>
      )}

      {/* Goals list */}
      {goals.map(g => {
        const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
        const done = pct >= 100;
        return (
          <Card key={g.id} style={{ position: "relative", border: done ? `1px solid ${C.success}` : `1px solid ${C.border}` }}>
            {done && (
              <div style={{
                position: "absolute", top: -10, right: 16,
                background: C.success, color: "#fff",
                fontSize: 11, fontWeight: 700, borderRadius: 99,
                padding: "2px 10px", letterSpacing: ".05em",
              }}>ДОСТИГНУТО 🎉</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{g.emoji}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Цель: {fmt(g.target)}</div>
                </div>
              </div>
              <button onClick={() => delGoal(g.id)} style={{
                background: "none", border: "none", color: C.muted,
                cursor: "pointer", fontSize: 18,
              }}>×</button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{fmt(g.saved)}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{Math.round(pct)}%</span>
              </div>
              <ProgressBar value={g.saved} max={g.target}
                color={done ? C.success : pct > 50 ? C.accent : C.accent2} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                Осталось: {fmt(Math.max(0, g.target - g.saved))}
              </div>
            </div>
            {!done && (
              <div style={{ display: "flex", gap: 8 }}>
                <Input
                  value={addAmt[g.id] || ""}
                  onChange={e => setAddAmt(a => ({ ...a, [g.id]: e.target.value }))}
                  placeholder="Добавить ₽"
                  type="number"
                  onKeyDown={e => e.key === "Enter" && contribute(g.id)}
                />
                <Btn onClick={() => contribute(g.id)} color={C.success} style={{ whiteSpace: "nowrap", padding: "9px 14px" }}>
                  + Пополнить
                </Btn>
              </div>
            )}
          </Card>
        );
      })}

      {/* Add goal */}
      <Card>
        <Label>Новая цель</Label>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Иконка</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                fontSize: 20, background: emoji === e ? C.faint : "transparent",
                border: `1.5px solid ${emoji === e ? C.accent : "transparent"}`,
                borderRadius: 8, padding: "4px 8px", cursor: "pointer",
              }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Название</div>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Отпуск в Таиланде" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Сумма ₽</div>
          <Input value={target} onChange={e => setTarget(e.target.value)}
            placeholder="150000" type="number"
            onKeyDown={e => e.key === "Enter" && addGoal()} />
        </div>
        <Btn onClick={addGoal} color={C.accent2} style={{ width: "100%" }}>+ Создать цель</Btn>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════
export default function CoupleApp() {
  const [tab, setTab] = useState("budget");
  const [state, setStateRaw] = useState(INIT);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  _setToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2500);
  };

  // Load shared state on mount
  useEffect(() => {
    loadState().then(s => {
      if (s) setStateRaw(s);
      setLoading(false);
    });
  }, []);

  // Save on every change
  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSyncing(true);
      saveState(next).finally(() => setSyncing(false));
      return next;
    });
  }, []);

  const TABS = [
    { id: "budget", label: "💰 Бюджет" },
    { id: "goals",  label: "🎯 Цели" },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.muted, fontSize: 16 }}>Загружаем данные…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px 0",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-.3px" }}>
              💑 Наши финансы
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {syncing ? "⟳ Синхронизация…" : "✓ Данные общие"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{
              background: C.faint, borderRadius: 99, padding: "4px 10px",
              fontSize: 12, color: C.accent2,
            }}>👩 Она</div>
            <div style={{
              background: C.faint, borderRadius: 99, padding: "4px 10px",
              fontSize: 12, color: C.accent3,
            }}>👨 Он</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: `2.5px solid ${tab === t.id ? C.accent : "transparent"}`,
              color: tab === t.id ? C.accent : C.muted,
              fontSize: 14, fontWeight: tab === t.id ? 700 : 400,
              cursor: "pointer", transition: "all .15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 540, margin: "0 auto" }}>
        {tab === "budget" && <BudgetTab state={state} setState={setState} />}
        {tab === "goals"  && <GoalsTab  state={state} setState={setState} />}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.accent, color: "#fff", borderRadius: 12,
          padding: "10px 22px", fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 24px rgba(0,0,0,.4)", zIndex: 100,
          whiteSpace: "nowrap",
        }}>{toastMsg}</div>
      )}
    </div>
  );
}
