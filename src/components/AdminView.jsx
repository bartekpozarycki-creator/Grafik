import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { FreeHours } from "./Availability"
import CalendarBoard from "./CalendarBoard"
import Shell from "./Shell"
import {
  countsAsStudent,
  countsMoney,
  dateInMonth,
  dateKey,
  formatMoney,
  formatShort,
  labelOf,
  lessonProfit,
  lessonRevenue,
  LEVELS,
  PRICE_LEVELS,
  todayKey,
} from "../lib/store"

function studentsLabel(count) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "uczeń"
  return "uczniów"
}

function studentKey(lesson) {
  return lesson.discord.trim().toLowerCase() || lesson.studentName.trim().toLowerCase()
}

function moneySum(lessons, pick) {
  return lessons.reduce((total, lesson) => total + pick(lesson), 0)
}

function PriceEditor({ prices, note, onSave }) {
  const [draft, setDraft] = useState(prices)
  const [base, setBase] = useState(prices)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  if (prices !== base) {
    setBase(prices)
    setDraft(prices)
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const next = {}
    for (const level of PRICE_LEVELS) {
      const value = String(draft[level.id] ?? "").trim()
      if (!/^\d+$/.test(value)) {
        setError("Podaj cenę w pełnych złotych.")
        setSaved(false)
        return
      }
      next[level.id] = Number(value)
    }
    setSaving(true)
    setError("")
    try {
      await onSave(next)
      setSaved(true)
    } catch (saveError) {
      setSaved(false)
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-stone-200 bg-white px-4 py-4">
      <p className="text-sm font-semibold text-stone-900">Ceny zajęć za godzinę</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRICE_LEVELS.map((level) => (
          <label key={level.id} className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">{level.label}</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft[level.id] ?? ""}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, [level.id]: event.target.value }))
                  setSaved(false)
                }}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2"
              />
              <span className="text-sm text-stone-500">zł</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
        >
          {saving ? "Zapisywanie…" : "Zapisz ceny"}
        </button>
        {saved && <span className="text-sm font-medium text-teal-800">Zapisane.</span>}
        {(error || note) && <span className="text-sm text-red-700">{error || note}</span>}
      </div>
    </form>
  )
}

function mixLabel(count, one, few, many) {
  const mod10 = count % 10
  const mod100 = count % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many
  return `${count} ${word}`
}

function tutorSummary(name, lessons, today) {
  const own = lessons.filter((lesson) => lesson.tutor === name)
  const untilToday = own.filter((lesson) => lesson.date <= today)
  let trial = 0
  let basic = 0
  let extended = 0
  let studies = 0
  for (const lesson of untilToday) {
    if (lesson.kind === "probna") {
      trial += 1
      continue
    }
    if (lesson.level === "rozszerzenie") extended += 1
    else if (lesson.level === "studia") studies += 1
    else basic += 1
  }
  const groups = new Map()
  for (const lesson of own) {
    const key = studentKey(lesson)
    const group = groups.get(key)
    if (group) group.push(lesson)
    else groups.set(key, [lesson])
  }
  let students = 0
  for (const group of groups.values()) {
    if (countsAsStudent(group)) students += 1
  }
  return {
    students,
    trial,
    basic,
    extended,
    studies,
  }
}

function TutorTile({ name, eyebrow, summary, active, onSelect, className = "" }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`h-full w-full rounded-2xl border px-4 py-4 text-left transition ${
        active ? "border-teal-800 bg-teal-50 shadow-sm" : "border-stone-200 bg-white hover:border-stone-300"
      } ${className}`}
    >
      <span className={`block text-xs font-semibold tracking-wide text-stone-500 ${eyebrow === "konto testowe" ? "" : "uppercase"}`}>
        {eyebrow}
      </span>
      <span className="mt-1 block text-lg font-semibold text-stone-900">{name}</span>
      <span className="mt-2 block text-sm font-medium text-stone-800">
        {summary.students} {studentsLabel(summary.students)}
      </span>
      <span className="mt-1 block text-sm font-medium">
        {summary.trial > 0 && (
          <span className="block text-yellow-600">{mixLabel(summary.trial, "próbna", "próbne", "próbnych")}</span>
        )}
        {summary.basic > 0 && (
          <span className="block text-blue-600">{mixLabel(summary.basic, "podstawowa", "podstawowe", "podstawowych")}</span>
        )}
        {summary.extended > 0 && (
          <span className="block text-violet-600">{mixLabel(summary.extended, "rozszerzona", "rozszerzone", "rozszerzonych")}</span>
        )}
        {summary.studies > 0 && (
          <span className="block text-amber-700">{mixLabel(summary.studies, "ze studiów", "ze studiów", "ze studiów")}</span>
        )}
      </span>
    </button>
  )
}

function lessonWhen(lesson) {
  const time = lesson.startsAt ? ` · ${String(lesson.startsAt).slice(0, 5)}` : ""
  return `${formatShort(lesson.date)}${time} · ${lesson.tutor} · ${lesson.studentName} · ${lesson.duration} min · ${labelOf(LEVELS, lesson.level)}`
}

function skipReasons(lesson, today) {
  const reasons = []
  if (lesson.kind === "probna") reasons.push("próbna")
  if (!countsMoney(lesson.tutor)) reasons.push("konto testowe")
  if (lesson.date <= today && lesson.held === false) reasons.push("nie odbyła się")
  if (lesson.date <= today && lesson.held == null) reasons.push("nieoznaczona")
  if (lesson.kind !== "probna" && countsMoney(lesson.tutor) && !lesson.studentPaid) reasons.push("uczeń nie zapłacił")
  return reasons
}

function weekStart(today) {
  const [year, month, day] = today.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  const lead = (date.getDay() + 6) % 7
  const start = new Date(year, month - 1, day - lead)
  return dateKey(start.getFullYear(), start.getMonth(), start.getDate())
}

function inMoneyScope(lesson, scope, today, year, month) {
  if (lesson.date > today) return false
  if (scope === "tydzien") return lesson.date >= weekStart(today)
  if (scope === "miesiac") return dateInMonth(lesson.date, year, month)
  if (scope === "rok") return lesson.date.startsWith(`${year}-`)
  return true
}

function MoneyPanel({ lessons, today, year, month }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState("miesiac")
  const scoped = lessons
    .filter((lesson) => inMoneyScope(lesson, scope, today, year, month))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.startsAt || "").localeCompare(String(b.startsAt || "")))
  const included = scoped.filter((lesson) => lessonRevenue(lesson) > 0)
  const excluded = scoped.filter((lesson) => lessonRevenue(lesson) <= 0)
  const turnover = moneySum(included, lessonRevenue)
  const ours = moneySum(included, lessonProfit)
  const emptyIncluded = {
    tydzien: "W tym tygodniu żadna lekcja nie weszła do obrotu.",
    miesiac: "W tym miesiącu żadna lekcja nie weszła do obrotu.",
    rok: "W tym roku żadna lekcja nie weszła do obrotu.",
    wszystko: "Żadna lekcja nie weszła do obrotu.",
  }
  const emptyExcluded = {
    tydzien: "Każda lekcja z tego tygodnia jest wliczona.",
    miesiac: "Każda lekcja z tego miesiąca jest wliczona.",
    rok: "Każda lekcja z tego roku jest wliczona.",
    wszystko: "Każda lekcja jest wliczona.",
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative grid w-full grid-cols-2 text-left"
      >
        <span className="px-4 py-4">
          <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">Obrót</span>
          <span className="mt-1 block text-2xl font-semibold text-stone-900">{formatMoney(turnover)}</span>
        </span>
        <span className="border-l border-stone-200 bg-teal-50 px-4 py-4">
          <span className="block text-xs font-semibold uppercase tracking-wide text-teal-800">My</span>
          <span className="mt-1 block text-2xl font-semibold text-teal-950">{formatMoney(ours)}</span>
        </span>
        <span className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500">
          <Chevron open={open} />
        </span>
      </button>
      <div className="flex flex-wrap gap-1.5 border-t border-stone-200 px-4 py-3">
        {[
          ["tydzien", "Tydzień"],
          ["miesiac", "Miesiąc"],
          ["rok", "Rok"],
          ["wszystko", "Wszystko"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={scope === id}
            onClick={() => setScope(id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              scope === id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-stone-200"
          >
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-stone-900">Wliczone ({included.length})</p>
                {included.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">{emptyIncluded[scope]}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {included.map((lesson) => (
                      <li key={lesson.id} className="text-sm text-stone-700">
                        <span className="block">{lessonWhen(lesson)}</span>
                        <span className="font-medium text-stone-900">
                          Obrót {formatMoney(lessonRevenue(lesson))} · my {formatMoney(lessonProfit(lesson))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">Niewliczone ({excluded.length})</p>
                {excluded.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">
                    {scoped.length === 0 ? "W tym zakresie nie ma odbytych lekcji." : emptyExcluded[scope]}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {excluded.map((lesson) => (
                      <li
                        key={lesson.id}
                        className={`text-sm text-stone-700 ${
                          lesson.kind !== "probna" ? "rounded-xl bg-red-100 px-2.5 py-2" : ""
                        }`}
                      >
                        <span className="block">{lessonWhen(lesson)}</span>
                        <span className="text-stone-500">{skipReasons(lesson, today).join(", ") || "poza obrotem"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const SHOW_TEST_KEY = "grafik.admin.test.v1"

function AdminMenu({ showTest, onShowTest }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex rounded-xl p-2 text-stone-600 transition hover:bg-white"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
          <path
            d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Zamknij menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="absolute top-full right-0 z-30 mt-2 w-64 rounded-2xl border border-stone-200 bg-white p-3 shadow-lg"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-stone-800">Konto testowe</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showTest}
                  aria-label="Konto testowe"
                  onClick={() => onShowTest(!showTest)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${showTest ? "bg-teal-800" : "bg-stone-300"}`}
                >
                  <motion.span
                    animate={{ x: showTest ? 20 : 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white"
                  />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Chevron({ open }) {
  return (
    <motion.svg
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2 }}
      viewBox="0 0 20 20"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  )
}

export default function AdminView({
  lessons,
  freeHours,
  notice,
  onLogout,
  onLessonPaid,
  onCreateFree,
  onUpdateFree,
  onDeleteFree,
  tutors,
  prices,
  pricesNote,
  onSavePrices,
  parents,
  onSaveParent,
}) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const regular = tutors.filter((item) => item.countsMoney !== false)
  const testAccount = tutors.find((item) => item.countsMoney === false) ?? null
  const [selected, setSelected] = useState(() => [regular[0]?.name ?? tutors[0]?.name ?? ""].filter(Boolean))
  const [testOpen, setTestOpen] = useState(false)
  const [showTest, setShowTest] = useState(() => localStorage.getItem(SHOW_TEST_KEY) === "1")
  const [today] = useState(() => todayKey())
  const shownLessons = showTest ? lessons : lessons.filter((lesson) => countsMoney(lesson.tutor))
  const roster = [...regular, ...(showTest && testAccount ? [testAccount] : [])]
  const picked = roster.map((item) => item.name).filter((name) => selected.includes(name))
  const activeNames = picked.length ? picked : [roster[0]?.name].filter(Boolean)
  const activeSet = new Set(activeNames)
  const visible = shownLessons.filter((lesson) => activeSet.has(lesson.tutor))

  function toggleTutor(name) {
    setSelected((current) => {
      if (current.includes(name)) {
        if (current.filter((item) => roster.some((tutor) => tutor.name === item)).length <= 1) return current
        return current.filter((item) => item !== name)
      }
      return [...current, name]
    })
  }

  function changeShowTest(next) {
    setShowTest(next)
    localStorage.setItem(SHOW_TEST_KEY, next ? "1" : "0")
    if (!next && testAccount) {
      setSelected((current) => {
        const rest = current.filter((name) => name !== testAccount.name)
        if (rest.length) return rest
        return regular[0] ? [regular[0].name] : []
      })
      setTestOpen(false)
    }
  }

  return (
    <Shell
      title="Admin"
      subtitle="Kalendarz każdego korepetytora"
      notice={notice}
      onLogout={onLogout}
      menu={<AdminMenu showTest={showTest} onShowTest={changeShowTest} />}
    >
      <PriceEditor prices={prices} note={pricesNote} onSave={onSavePrices} />
      <MoneyPanel lessons={shownLessons} today={today} year={year} month={month} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
          {regular.map((item) => (
            <TutorTile
              key={item.name}
              name={item.name}
              eyebrow="Korepetytor"
              summary={tutorSummary(item.name, lessons, today)}
              active={activeSet.has(item.name)}
              onSelect={() => toggleTutor(item.name)}
            />
          ))}
        </div>
        {showTest && testAccount && (
          <div className={`shrink-0 ${testOpen ? "lg:w-72" : "lg:w-48"}`}>
            <AnimatePresence initial={false} mode="wait">
              {testOpen ? (
                <motion.div
                  key="test-open"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="relative h-full"
                >
                  <TutorTile
                    name={testAccount.name}
                    eyebrow="konto testowe"
                    summary={tutorSummary(testAccount.name, lessons, today)}
                    active={activeSet.has(testAccount.name)}
                    onSelect={() => toggleTutor(testAccount.name)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label="Zwiń konto testowe"
                    onClick={() => setTestOpen(false)}
                    className="absolute top-3 right-3 inline-flex rounded-lg p-1 text-stone-500 transition hover:bg-white hover:text-stone-800"
                  >
                    <Chevron open />
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="test-closed"
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => {
                    setTestOpen(true)
                    setSelected((current) =>
                      current.includes(testAccount.name) ? current : [...current, testAccount.name],
                    )
                  }}
                  aria-expanded={false}
                  aria-pressed={activeSet.has(testAccount.name)}
                  className={`flex h-full min-h-28 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                    activeSet.has(testAccount.name)
                      ? "border-teal-800 bg-teal-50 shadow-sm"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <span>
                    <span className="block text-xs font-semibold text-stone-500">konto testowe</span>
                    <span className="mt-1 block text-lg font-semibold text-stone-900">{testAccount.name}</span>
                  </span>
                  <span className="text-stone-500">
                    <Chevron open={false} />
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      <motion.div
        key={activeNames.join("|")}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <FreeHours
          tutor={activeNames[0] ?? ""}
          tutors={activeNames}
          hours={freeHours}
          canEdit={activeNames.length === 1}
          onCreate={(entries) => onCreateFree(activeNames[0], entries)}
          onUpdate={(id, data) => onUpdateFree(activeNames[0], id, data)}
          onDelete={(id) => onDeleteFree(activeNames[0], id)}
        />
        <CalendarBoard
          person={activeNames.join(", ")}
          people={activeNames}
          year={year}
          month={month}
          onYearMonth={(nextYear, nextMonth) => {
            setYear(nextYear)
            setMonth(nextMonth)
          }}
          lessons={visible}
          freeHours={freeHours}
          canEdit={false}
          canMarkPayment
          onLessonPaid={onLessonPaid}
          parents={parents}
          onSaveParent={onSaveParent}
          onUpdateFree={(id, data) => {
            const slot = freeHours.find((item) => item.id === id)
            if (slot) return onUpdateFree(slot.tutor, id, data)
          }}
        />
      </motion.div>
    </Shell>
  )
}
