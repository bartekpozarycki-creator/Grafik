import { Fragment, useState } from "react"
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
  trialPayout,
  DURATIONS,
  lessonPriceFor,
  LEVELS,
  paySplit,
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
  const [open, setOpen] = useState(true)
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
      for (const id of level.levels) next[id] = Number(value)
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
    <section className="mb-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-stone-900">Ceny zajęć za godzinę</span>
          <span className="mt-1 block text-sm text-stone-500">Ile płaci uczeń za godzinę na danym poziomie.</span>
        </span>
        <Chevron open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key="prices"
            onSubmit={submit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-stone-200"
          >
            <div className="px-4 py-4">
              <p className="text-sm text-stone-500">
                Zajęcia 45 min: podstawa 70 zł, rozszerzenie 80 zł. Zajęcia 90 min: podstawa 130 zł, rozszerzenie 140 zł.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  )
}

function formatAmount(amount) {
  const value = Math.round(Number(amount) * 100) / 100
  return String(value)
}

function parseAmount(value) {
  const text = String(value ?? "").trim().replace(",", ".")
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null
  const amount = Number(text)
  return Number.isFinite(amount) ? amount : null
}

function balancedCell(prices, tutorPay, level, duration) {
  const price = lessonPriceFor(level, duration, prices)
  const tutor = Math.min(price, Math.max(0, tutorPay))
  return {
    tutor: formatAmount(tutor),
    school: formatAmount(price - tutor),
  }
}

function rateDraft(people, prices) {
  const draft = {}
  for (const tutor of people) {
    draft[tutor.name] = {}
    for (const level of PRICE_LEVELS) {
      draft[tutor.name][level.id] = {}
      for (const duration of DURATIONS) {
        const saved = level.levels
          .map((id) => tutor.pay?.[id]?.[String(duration)])
          .find((cell) => cell?.tutor != null)
        const fallback = paySplit(prices, tutor.profit, level.id, duration).tutor
        const tutorPay = saved?.tutor != null ? Number(saved.tutor) : fallback
        draft[tutor.name][level.id][duration] = balancedCell(prices, tutorPay, level.id, duration)
      }
    }
  }
  return draft
}

function tutorHasLevel(name, level, lessons) {
  const ids = new Set(level.levels)
  return lessons.some((lesson) => lesson.tutor === name && ids.has(lesson.level))
}

function RateEditor({ tutors, lessons, prices, onSave }) {
  const people = tutors.filter((tutor) => tutor.countsMoney !== false)
  const [open, setOpen] = useState(true)
  const [openTutor, setOpenTutor] = useState(() => Object.fromEntries(people.map((tutor) => [tutor.name, true])))
  const [draft, setDraft] = useState(() => rateDraft(people, prices))
  const [base, setBase] = useState(tutors)
  const [priceBase, setPriceBase] = useState(prices)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  if (tutors !== base || prices !== priceBase) {
    setBase(tutors)
    setPriceBase(prices)
    setDraft(rateDraft(people, prices))
  }

  function changeCell(name, level, duration, side, value) {
    const price = lessonPriceFor(level, duration, prices)
    const amount = parseAmount(value)
    setDraft((current) => {
      const previous = current[name][level][duration]
      let next = { ...previous, [side]: value, anchor: side }
      if (amount != null) {
        const capped = Math.min(price, Math.max(0, amount))
        const rest = formatAmount(price - capped)
        next = {
          tutor: side === "tutor" ? (amount > price ? formatAmount(price) : value) : rest,
          school: side === "school" ? (amount > price ? formatAmount(price) : value) : rest,
          anchor: side,
        }
      }
      return {
        ...current,
        [name]: {
          ...current[name],
          [level]: { ...current[name][level], [duration]: next },
        },
      }
    })
    setSaved(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const next = {}
    for (const tutor of people) {
      next[tutor.name] = {}
      for (const level of PRICE_LEVELS) {
        for (const duration of DURATIONS) {
          const current = draft[tutor.name]?.[level.id]?.[duration] ?? {}
          const anchor = current.anchor === "school" ? "school" : "tutor"
          const amount = parseAmount(current[anchor])
          if (amount == null) {
            setError("Podaj kwoty w złotych.")
            setSaved(false)
            return
          }
          const price = lessonPriceFor(level.id, duration, prices)
          const capped = Math.min(price, Math.max(0, amount))
          const rest = Math.round((price - capped) * 100) / 100
          const share = {
            tutor: anchor === "tutor" ? capped : rest,
            school: anchor === "school" ? capped : rest,
          }
          for (const id of level.levels) {
            next[tutor.name][id] = next[tutor.name][id] ?? {}
            next[tutor.name][id][String(duration)] = share
          }
        }
      }
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
    <section className="mb-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-stone-900">Stawki</span>
          <span className="mt-1 block text-sm text-stone-500">
            Ile z zajęć dostaje korepetytor, a ile szkoła — osobno dla poziomu i długości.
          </span>
        </span>
        <Chevron open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key="rates"
            onSubmit={submit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-stone-200"
          >
            <div className="space-y-3 px-4 py-4">
              {people.map((tutor) => {
                const expanded = openTutor[tutor.name] !== false
                const rows = PRICE_LEVELS.filter((level) => tutorHasLevel(tutor.name, level, lessons))
                return (
                  <div key={tutor.name} className="overflow-hidden rounded-xl border border-stone-200">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpenTutor((current) => ({ ...current, [tutor.name]: !expanded }))}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    >
                      <span className="text-sm font-semibold text-stone-900">{tutor.name}</span>
                      <Chevron open={expanded} />
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-stone-200"
                        >
                          <div className="overflow-x-auto px-3 py-3">
                            {rows.length === 0 ? (
                              <p className="text-sm text-stone-500">Brak uczniów z wycenianym poziomem.</p>
                            ) : (
                            <table className="w-full min-w-[720px] border-separate border-spacing-x-1.5 text-left">
                              <thead>
                                <tr>
                                  <th className="pb-1" />
                                  {DURATIONS.map((duration) => (
                                    <th
                                      key={duration}
                                      colSpan={2}
                                      className="pb-1 text-center text-xs font-semibold text-stone-700"
                                    >
                                      {duration} min
                                    </th>
                                  ))}
                                </tr>
                                <tr>
                                  <th className="pb-2 pr-3 text-xs font-medium text-stone-500">Poziom</th>
                                  {DURATIONS.map((duration) => (
                                    <Fragment key={duration}>
                                      <th className="pb-2 text-xs font-medium text-stone-500">Korepetytor</th>
                                      <th className="pb-2 text-xs font-medium text-stone-500">Szkoła</th>
                                    </Fragment>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((level) => (
                                  <tr key={level.id}>
                                    <th className="py-1.5 pr-3 text-sm font-medium text-stone-800">{level.label}</th>
                                    {DURATIONS.map((duration) => {
                                      const cell = draft[tutor.name]?.[level.id]?.[duration] ?? { tutor: "", school: "" }
                                      return (
                                        <Fragment key={duration}>
                                          {["tutor", "school"].map((side) => (
                                            <td key={side} className="py-1.5">
                                              <label className="flex items-center gap-1">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.5"
                                                  inputMode="numeric"
                                                  aria-label={`${tutor.name}, ${level.label}, ${duration} min, ${side === "tutor" ? "korepetytor" : "szkoła"}`}
                                                  value={cell[side]}
                                                  onChange={(event) =>
                                                    changeCell(tutor.name, level.id, duration, side, event.target.value)
                                                  }
                                                  className="w-16 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none ring-teal-800 focus:ring-2"
                                                />
                                                <span className="text-xs text-stone-400">zł</span>
                                              </label>
                                            </td>
                                          ))}
                                        </Fragment>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
                >
                  {saving ? "Zapisywanie…" : "Zapisz stawki"}
                </button>
                {saved && <span className="text-sm font-medium text-teal-800">Zapisane.</span>}
                {error && <span className="text-sm text-red-700">{error}</span>}
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
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

function lessonStamp(lesson) {
  return `${lesson.date}T${String(lesson.startsAt || "")}`
}

function stayedAfterTrial(trial, lessons) {
  const key = studentKey(trial)
  const trialAt = lessonStamp(trial)
  return lessons.some((lesson) => {
    if (lesson.id === trial.id || lesson.kind !== "zwykla" || lesson.held !== true) return false
    if (studentKey(lesson) !== key) return false
    if (lesson.date !== trial.date) return lesson.date > trial.date
    if (!trial.startsAt || !lesson.startsAt) return true
    return lessonStamp(lesson) > trialAt
  })
}

function MoneyPanel({ lessons, today, year, month }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState("miesiac")
  const scoped = lessons
    .filter((lesson) => inMoneyScope(lesson, scope, today, year, month))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.startsAt || "").localeCompare(String(b.startsAt || "")))
  const included = scoped.filter((lesson) => lessonRevenue(lesson) > 0)
  const deducted = scoped.flatMap((lesson) => {
    const stayed = stayedAfterTrial(lesson, lessons)
    const amount = trialPayout(lesson, stayed)
    return amount > 0 ? [{ lesson, amount, stayed }] : []
  })
  const missed = scoped.filter((lesson) => lesson.held === false)
  const unpaid = scoped.filter(
    (lesson) => lessonRevenue(lesson) <= 0 && lesson.held !== false && !deducted.some((item) => item.lesson.id === lesson.id),
  )
  const turnover = moneySum(included, lessonRevenue)
  const ours = moneySum(included, lessonProfit)
  const taken = deducted.reduce((total, item) => total + item.amount, 0)
  const left = ours - taken
  const emptyIncluded = {
    tydzien: "W tym tygodniu żadna lekcja nie weszła do obrotu.",
    miesiac: "W tym miesiącu żadna lekcja nie weszła do obrotu.",
    rok: "W tym roku żadna lekcja nie weszła do obrotu.",
    wszystko: "Żadna lekcja nie weszła do obrotu.",
  }
  const emptyDeducted = {
    tydzien: "W tym tygodniu nie ma kosztu za próbne.",
    miesiac: "W tym miesiącu nie ma kosztu za próbne.",
    rok: "W tym roku nie ma kosztu za próbne.",
    wszystko: "Nie ma kosztu za próbne.",
  }
  const emptyUnpaid = {
    tydzien: "W tym tygodniu nie ma nieopłaconych lekcji.",
    miesiac: "W tym miesiącu nie ma nieopłaconych lekcji.",
    rok: "W tym roku nie ma nieopłaconych lekcji.",
    wszystko: "Nie ma nieopłaconych lekcji.",
  }
  const emptyMissed = {
    tydzien: "W tym tygodniu nie ma nieodbytych lekcji.",
    miesiac: "W tym miesiącu nie ma nieodbytych lekcji.",
    rok: "W tym roku nie ma nieodbytych lekcji.",
    wszystko: "Nie ma nieodbytych lekcji.",
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-stretch text-left"
      >
        <span className="min-w-0 flex-1 px-3 py-4 sm:px-4">
          <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">Obrót</span>
          <span className="mt-1 block text-xl font-semibold text-stone-900 sm:text-2xl">{formatMoney(turnover)}</span>
        </span>
        <span className="min-w-0 flex-1 border-l border-stone-200 bg-teal-50 px-3 py-4 sm:px-4">
          <span className="block text-xs font-semibold uppercase tracking-wide text-teal-800">Do nas</span>
          <span className="mt-1 block text-xl font-semibold text-teal-950 sm:text-2xl">{formatMoney(ours)}</span>
        </span>
        <span className="min-w-0 flex-1 border-l border-stone-200 bg-rose-50 px-3 py-4 sm:px-4">
          <span className="block text-xs font-semibold uppercase tracking-wide text-rose-800">Koszt za próbne</span>
          <span className="mt-1 block text-xl font-semibold text-rose-950 sm:text-2xl">{formatMoney(taken)}</span>
        </span>
        <span className="flex items-center px-2 text-stone-500 sm:px-3">
          <Chevron open={open} />
        </span>
      </button>
      <div className="border-t border-stone-200 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Zostaje</span>
        <span className={`mt-1 block text-lg font-semibold ${left < 0 ? "text-rose-800" : "text-stone-900"}`}>
          {formatMoney(left)}
        </span>
      </div>
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
                          Obrót {formatMoney(lessonRevenue(lesson))} · do nas {formatMoney(lessonProfit(lesson))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">Koszt za próbne ({deducted.length})</p>
                {deducted.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">{emptyDeducted[scope]}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {deducted.map(({ lesson, amount, stayed }) => (
                      <li key={lesson.id} className="text-sm text-stone-700">
                        <span className="block">{lessonWhen(lesson)}</span>
                        <span className="font-medium text-rose-900">
                          {stayed ? "Cała stawka godzinowa" : "Połowa stawki godzinowej"} · {formatMoney(amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="grid gap-4 border-t border-stone-200 px-4 py-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-stone-900">Nieopłacone ({unpaid.length})</p>
                {unpaid.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">{emptyUnpaid[scope]}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {unpaid.map((lesson) => (
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
              <div>
                <p className="text-sm font-semibold text-stone-900">Nieodbyte ({missed.length})</p>
                {missed.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500">{emptyMissed[scope]}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {missed.map((lesson) => (
                      <li key={lesson.id} className="rounded-xl bg-stone-100 px-2.5 py-2 text-sm text-stone-500">
                        {lessonWhen(lesson)}
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
  onRenameStudent,
  onUpdateLesson,
  onSaveRates,
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
      <RateEditor tutors={tutors} lessons={lessons} prices={prices} onSave={onSaveRates} />
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
          canEditLessons
          canMarkPayment
          onLessonPaid={onLessonPaid}
          onUpdate={(id, data) => {
            const lesson = lessons.find((item) => item.id === id)
            if (lesson) return onUpdateLesson(lesson.tutor, id, data)
          }}
          parents={parents}
          onSaveParent={onSaveParent}
          onRenameStudent={onRenameStudent}
          onUpdateFree={(id, data) => {
            const slot = freeHours.find((item) => item.id === id)
            if (slot) return onUpdateFree(slot.tutor, id, data)
          }}
        />
      </motion.div>
    </Shell>
  )
}
