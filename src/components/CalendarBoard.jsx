import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { freeBreaks, shiftForBreak } from "../lib/availability"
import {
  DURATIONS,
  KINDS,
  LEVELS,
  WEEKDAYS,
  countsAsStudent,
  buildMonthCells,
  dateInMonth,
  dateKey,
  formatDay,
  formatMinutes,
  labelOf,
  lessonsLabel,
  monthTitle,
  todayKey,
} from "../lib/store"

const EMPTY_FORM = {
  studentName: "",
  discord: "",
  startsAt: "16:00",
  duration: 60,
  kind: "zwykla",
  level: "podstawa",
}

function lessonEndsAt(lesson) {
  if (!lesson.startsAt) return ""
  const [hour, minute] = String(lesson.startsAt).slice(0, 5).split(":").map(Number)
  const total = Math.min(24 * 60, hour * 60 + minute + Number(lesson.duration || 0))
  const endHour = Math.floor(total / 60)
  const endMinute = total % 60
  return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`
}

function lessonSpan(lesson) {
  const endsAt = lessonEndsAt(lesson)
  if (!endsAt) return ""
  return `${String(lesson.startsAt).slice(0, 5)}–${endsAt}`
}

const DURATION_OPTIONS = DURATIONS.map((value) => ({ id: value, label: `${value} min` }))

const LEVEL_TONE = {
  podstawa: "stone",
  podstawowka: "sky",
  rozszerzenie: "violet",
  studia: "amber",
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ")
}

function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer = 0
    function arm() {
      const current = new Date()
      setNow(current)
      const wait = 60000 - (current.getSeconds() * 1000 + current.getMilliseconds())
      timer = window.setTimeout(arm, Math.max(wait, 250))
    }
    const current = new Date()
    const wait = 60000 - (current.getSeconds() * 1000 + current.getMilliseconds())
    timer = window.setTimeout(arm, Math.max(wait, 250))
    return () => window.clearTimeout(timer)
  }, [])
  return now
}

function formatNow(date) {
  const formatted = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function Badge({ children, tone = "stone" }) {
  const tones = {
    stone: "bg-stone-100 text-stone-700",
    teal: "bg-teal-100 text-teal-900",
    amber: "bg-amber-100 text-amber-950",
    sky: "bg-sky-100 text-sky-900",
    violet: "bg-violet-100 text-violet-900",
    rose: "bg-rose-100 text-rose-900",
  }
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center justify-center rounded-full px-2.5 text-xs font-medium leading-none",
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function BreakLength({ minutes, max, busy, onChange }) {
  const [draft, setDraft] = useState(String(minutes))
  const [seen, setSeen] = useState(minutes)
  if (seen !== minutes) {
    setSeen(minutes)
    setDraft(String(minutes))
  }

  function commit(raw) {
    const parsed = Number(raw)
    if (!Number.isInteger(parsed)) {
      setDraft(String(minutes))
      return
    }
    const next = Math.max(0, Math.min(max, parsed))
    setDraft(String(next))
    if (next !== minutes) onChange(next)
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Krótsza przerwa"
        disabled={busy || minutes <= 0}
        onClick={() => onChange(minutes - 1)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-400 bg-white text-base leading-none text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={draft}
        disabled={busy}
        aria-label="Długość przerwy w minutach"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit(event.currentTarget.value)
          }
        }}
        className="h-7 w-14 rounded-lg border border-stone-400 bg-white px-1 text-center text-sm tabular-nums outline-none ring-stone-600 focus:ring-2 disabled:opacity-40"
      />
      <button
        type="button"
        aria-label="Dłuższa przerwa"
        disabled={busy || minutes >= max}
        onClick={() => onChange(minutes + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-400 bg-white text-base leading-none text-stone-800 transition hover:bg-stone-50 disabled:opacity-40"
      >
        +
      </button>
    </span>
  )
}

function lessonChip(lesson) {
  if (lesson.held === false) return "bg-stone-200 text-stone-500"
  if (lesson.kind === "probna") return "bg-amber-100 text-amber-950"
  return "bg-teal-100 text-teal-950"
}

function payMarks(lesson) {
  if (lesson.held === false) return []
  const marks = []
  if (lesson.kind !== "probna" && !lesson.studentPaid) marks.push({ key: "student", className: "text-[#8B5A2B]" })
  if (!lesson.tutorPaid) marks.push({ key: "tutor", className: "text-red-600" })
  return marks
}

function dayPayCounts(lessons) {
  const counts = { student: 0, tutor: 0 }
  for (const lesson of lessons) {
    for (const mark of payMarks(lesson)) counts[mark.key] += 1
  }
  return [
    counts.student > 0 && { key: "student", count: counts.student, className: "text-[#8B5A2B]" },
    counts.tutor > 0 && { key: "tutor", count: counts.tutor, className: "text-red-600" },
  ].filter(Boolean)
}

function awaitsHeldMark(lesson, today) {
  return lesson.held == null && lesson.date <= today
}

function heldBadge(lesson) {
  if (lesson.held === true) return { text: "Odbyły się", tone: "teal" }
  if (lesson.held === false) return { text: "Nie odbyły się", tone: "rose" }
  return { text: "Nieoznaczone", tone: "stone" }
}

function HeldMark({ held, blink, disabled, onChange }) {
  const options = [
    { value: true, label: "Odbyły się", active: "border-teal-800 bg-teal-800 text-white" },
    { value: false, label: "Nie odbyły się", active: "border-rose-800 bg-rose-800 text-white" },
  ]
  return (
    <div className="mt-3">
      {disabled ? (
        <p className="mb-2 text-xs font-medium text-stone-400">
          Zaznaczenie będzie możliwe w dniu zajęć.
        </p>
      ) : (
        held == null && (
          <p className={cx("mb-2 text-xs font-medium text-stone-500", blink && "animate-pulse")}>
            Zaznacz, czy zajęcia się odbyły.
          </p>
        )
      )}
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = held === option.value
          return (
            <button
              key={option.label}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled || selected) return
                onChange(option.value)
              }}
              className={`flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold leading-none transition ${
                disabled
                  ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                  : selected
                    ? option.active
                    : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PaymentChecks({ lesson, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      {lesson.kind !== "probna" && (
        <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
          <input
            type="checkbox"
            checked={lesson.studentPaid}
            onChange={() => onChange({ studentPaid: !lesson.studentPaid })}
            className="accent-teal-800"
          />
          Uczeń zapłacił
        </label>
      )}
      <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
        <input
          type="checkbox"
          checked={lesson.tutorPaid}
          onChange={() => onChange({ tutorPaid: !lesson.tutorPaid })}
          className="accent-teal-800"
        />
        Korepetytor opłacony
      </label>
    </div>
  )
}

function studentKey(lesson) {
  const discord = lesson.discord.trim().toLowerCase()
  return discord || lesson.studentName.trim().toLowerCase()
}

function kindCountLabel(count, one, few, many) {
  const amount = Math.abs(Number(count) || 0)
  if (amount === 1) return `${amount} ${one}`
  const mod10 = amount % 10
  const mod100 = amount % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${amount} ${few}`
  return `${amount} ${many}`
}

function ComposerHeading({ title, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 sm:col-span-2">
      <p className="text-sm font-semibold text-stone-800">{title}</p>
      {children && <div className="ml-auto lg:hidden">{children}</div>}
    </div>
  )
}

function EntrySwitch({ mode, onLesson, onOwn, onFree, compact = false }) {
  const options = [
    { id: "lesson", label: "Lekcja", onClick: onLesson, activeClass: "bg-stone-900 text-white" },
    { id: "own", label: "Własne", onClick: onOwn, activeClass: "bg-indigo-800 text-white" },
    { id: "free", label: "Wolne godziny", onClick: onFree, activeClass: "bg-sky-800 text-white" },
  ]
  return (
    <div className={cx("flex flex-nowrap justify-end", compact ? "gap-1" : "flex-wrap gap-2")}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={mode === option.id}
          onClick={option.onClick}
          className={cx(
            "shrink-0 whitespace-nowrap rounded-full font-medium transition",
            compact ? "px-1.5 py-1 text-xs! leading-none!" : "px-3 py-1.5 text-sm",
            mode === option.id ? option.activeClass : "bg-stone-100 text-stone-700 hover:bg-stone-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ChoiceGroup({ label, value, options, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-stone-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cx(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ParentField({ value, onSave }) {
  const [text, setText] = useState(value ?? "")
  const [note, setNote] = useState("")

  useEffect(() => {
    setText(value ?? "")
  }, [value])

  async function commit(event) {
    const next = event.target.value.trim()
    if (next === (value ?? "").trim()) return
    setNote("Zapisywanie…")
    try {
      await onSave(next)
      setNote("Zapisano")
    } catch (error) {
      setNote(error.message)
    }
  }

  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-medium text-stone-500">Dane rodzica</span>
      <textarea
        value={text}
        rows={3}
        maxLength={2000}
        placeholder="Imię, telefon i inne informacje"
        onChange={(event) => {
          setText(event.target.value)
          setNote("")
        }}
        onBlur={commit}
        className="w-full resize-none rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-900 outline-none transition focus:border-teal-700"
      />
      {note && <span className="mt-1 block text-xs text-stone-500">{note}</span>}
    </label>
  )
}

export default function CalendarBoard({
  person,
  people,
  year,
  month,
  onYearMonth,
  lessons,
  freeHours = [],
  canEdit,
  canEditLessons = false,
  canMarkPayment = false,
  onLessonPaid,
  onLessonHeld,
  onCreate,
  onUpdate,
  onDelete,
  personalEvents = [],
  onCreatePersonal,
  onUpdatePersonal,
  onDeletePersonal,
  parents = {},
  onSaveParent,
  onRenameStudent,
  onUpdateFree,
  onCreateFree,
}) {
  const now = useMinuteClock()
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [payError, setPayError] = useState("")
  const [studentScope, setStudentScope] = useState("wszystko")
  const [intent, setIntent] = useState(null)
  const [own, setOwn] = useState({ title: "", startsAt: "16:00", endsAt: "17:00" })
  const [ownId, setOwnId] = useState(null)
  const [ownError, setOwnError] = useState("")
  const [ownConfirm, setOwnConfirm] = useState(null)
  const [breakBusy, setBreakBusy] = useState("")
  const [freeDraft, setFreeDraft] = useState(null)
  const [freeForm, setFreeForm] = useState({ startsAt: "15:00", endsAt: "18:00" })
  const [freeError, setFreeError] = useState("")
  const [freeBusy, setFreeBusy] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [studentDraft, setStudentDraft] = useState({ name: "", discord: "" })
  const [studentError, setStudentError] = useState("")
  const [studentBusy, setStudentBusy] = useState(false)

  const names = people?.length ? people : [person]
  const nameSet = new Set(names)
  const several = names.length > 1
  const monthLessons = lessons
    .filter((lesson) => dateInMonth(lesson.date, year, month))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startsAt || "99:99").localeCompare(b.startsAt || "99:99") ||
        (a.createdAt ?? 0) - (b.createdAt ?? 0),
    )
  const byDate = new Map()
  for (const lesson of monthLessons) {
    const bucket = byDate.get(lesson.date)
    if (bucket) bucket.push(lesson)
    else byDate.set(lesson.date, [lesson])
  }

  const slotsByDate = new Map()
  for (const slot of freeHours) {
    if (!nameSet.has(slot.tutor) || !dateInMonth(slot.date, year, month)) continue
    const bucket = slotsByDate.get(slot.date)
    if (bucket) bucket.push(slot)
    else slotsByDate.set(slot.date, [slot])
  }
  for (const bucket of slotsByDate.values()) {
    bucket.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }

  const personalByDate = new Map()
  for (const event of personalEvents) {
    if (!nameSet.has(event.tutor) || !dateInMonth(event.date, year, month)) continue
    const bucket = personalByDate.get(event.date)
    if (bucket) bucket.push(event)
    else personalByDate.set(event.date, [event])
  }

  const breaksByDate = new Map()
  const pauses = freeBreaks(
    [
      ...lessons
        .filter((lesson) => nameSet.has(lesson.tutor))
        .map((lesson) => ({
          id: lesson.id,
          tutor: lesson.tutor,
          date: lesson.date,
          startsAt: lesson.startsAt ? String(lesson.startsAt).slice(0, 5) : "",
          endsAt: lessonEndsAt(lesson),
          followerKind: "lesson",
        })),
      ...personalEvents
        .filter((event) => nameSet.has(event.tutor))
        .map((event) => ({
          id: event.id,
          tutor: event.tutor,
          date: event.date,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          followerKind: "own",
        })),
    ],
    freeHours,
  )
  for (const pause of pauses) {
    if (!dateInMonth(pause.date, year, month)) continue
    const bucket = breaksByDate.get(pause.date)
    if (bucket) bucket.push(pause)
    else breaksByDate.set(pause.date, [pause])
  }

  const qualifiedStudents = new Set()
  const history = new Map()
  for (const lesson of lessons) {
    const key = studentKey(lesson)
    const group = history.get(key)
    if (group) group.push(lesson)
    else history.set(key, [lesson])
  }
  for (const [key, group] of history) {
    if (countsAsStudent(group)) qualifiedStudents.add(key)
  }
  const scopedLessons = lessons.filter((lesson) => {
    if (studentScope === "miesiac") return dateInMonth(lesson.date, year, month)
    if (studentScope === "rok") return lesson.date.startsWith(`${year}-`)
    return true
  })
  const students = [...scopedLessons.reduce((groups, lesson) => {
    const key = studentKey(lesson)
    const group = groups.get(key)
    if (group) group.push(lesson)
    else groups.set(key, [lesson])
    return groups
  }, new Map()).values()]
    .filter((group) => qualifiedStudents.has(studentKey(group[0])))
    .map((group) => {
      const latest = [...group].sort(
        (a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0),
      )[0]
      return {
        key: studentKey(latest),
        name: latest.studentName,
        discord: latest.discord,
        levels: [...new Set(group.map((lesson) => lesson.level))],
        tutors: [...new Set(group.map((lesson) => lesson.tutor))].sort((a, b) => a.localeCompare(b, "pl")),
        regular: group.filter((lesson) => lesson.kind === "zwykla").length,
        trial: group.filter((lesson) => lesson.kind === "probna").length,
        minutes: group.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pl"))
  const cells = buildMonthCells(year, month)
  const today = todayKey()
  const dayLessons = selected ? (byDate.get(selected) ?? []) : []
  const daySlots = selected ? (slotsByDate.get(selected) ?? []) : []
  const dayOwn = selected ? (personalByDate.get(selected) ?? []) : []
  const dayBreaks = selected ? (breaksByDate.get(selected) ?? []) : []
  const dayEntries = [
    ...dayBreaks.map((pause) => ({ kind: "pause", id: pause.id, start: pause.startsAt, pause })),
    ...daySlots.map((slot) => ({ kind: "slot", id: slot.id, start: slot.startsAt, slot })),
    ...dayLessons.map((lesson) => ({
      kind: "lesson",
      id: lesson.id,
      start: lesson.startsAt || "99:99",
      lesson,
    })),
    ...dayOwn.map((event) => ({
      kind: "own",
      id: event.id,
      start: event.startsAt || "99:99",
      event,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  async function markHeld(lesson, held) {
    if (lesson.date > today) return
    setPayError("")
    try {
      await onLessonHeld(lesson.id, held)
    } catch (error) {
      setPayError(error.message)
    }
  }

  async function setBreak(pause, minutes) {
    setPayError("")
    setBreakBusy(pause.id)
    try {
      if (pause.followerKind === "own") {
        const event = personalEvents.find((item) => item.id === pause.followerId)
        if (!event || !onUpdatePersonal) return
        const shifted = shiftForBreak(event, pause, minutes)
        await onUpdatePersonal(event.id, { ...event, ...shifted })
      } else {
        const lesson = lessons.find((item) => item.id === pause.followerId)
        if (!lesson || !onUpdate) return
        const shifted = shiftForBreak({ ...lesson, endsAt: lessonEndsAt(lesson) }, pause, minutes)
        await onUpdate(lesson.id, { ...lesson, startsAt: shifted.startsAt })
      }
    } catch (error) {
      setPayError(error.message)
    } finally {
      setBreakBusy("")
    }
  }

  async function markPaid(lesson, patch) {
    setPayError("")
    try {
      await onLessonPaid(lesson.id, patch)
    } catch (error) {
      setPayError(error.message)
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFormError({})
    setPayError("")
    setConfirmId(null)
    setIntent(null)
    setOwn({ title: "", startsAt: "16:00", endsAt: "17:00" })
    setOwnId(null)
    setOwnError("")
    setOwnConfirm(null)
    setFreeDraft(null)
    setFreeForm({ startsAt: "15:00", endsAt: "18:00" })
    setFreeError("")
  }

  function beginStudentEdit(student) {
    setEditingStudent(student.key)
    setStudentDraft({ name: student.name, discord: student.discord })
    setStudentError("")
  }

  function cancelStudentEdit() {
    setEditingStudent(null)
    setStudentError("")
  }

  async function saveStudent(event) {
    event.preventDefault()
    if (!onRenameStudent || !editingStudent) return
    const studentName = studentDraft.name.trim()
    const discord = studentDraft.discord.trim()
    if (!studentName) {
      setStudentError("Podaj imię.")
      return
    }
    if (!discord) {
      setStudentError("Podaj nazwę na Discordzie.")
      return
    }
    setStudentBusy(true)
    setStudentError("")
    try {
      await onRenameStudent(editingStudent, { studentName, discord })
      setEditingStudent(null)
    } catch (error) {
      setStudentError(error.message)
    } finally {
      setStudentBusy(false)
    }
  }

  function openFree() {
    setEditingId(null)
    setOwnId(null)
    setOwnError("")
    setFormError({})
    setIntent("free")
    setFreeDraft(null)
    setFreeError("")
  }

  function beginFreeEdit(slot) {
    setEditingId(null)
    setOwnId(null)
    setOwnError("")
    setFormError({})
    setIntent("free")
    setFreeDraft({ id: slot.id, date: slot.date })
    setFreeForm({ startsAt: slot.startsAt, endsAt: slot.endsAt })
    setFreeError("")
  }

  function cancelFreeEdit() {
    setFreeDraft(null)
    setFreeForm({ startsAt: "15:00", endsAt: "18:00" })
    setFreeError("")
  }

  async function saveFree(event) {
    event.preventDefault()
    if (!freeForm.startsAt || !freeForm.endsAt || freeForm.endsAt <= freeForm.startsAt) {
      setFreeError("Godzina końca musi być późniejsza niż początek.")
      return
    }
    setFreeBusy(true)
    setFreeError("")
    try {
      if (freeDraft?.id) {
        await onUpdateFree(freeDraft.id, {
          date: freeDraft.date,
          startsAt: freeForm.startsAt,
          endsAt: freeForm.endsAt,
        })
        cancelFreeEdit()
      } else if (onCreateFree) {
        await onCreateFree([{ date: selected, startsAt: freeForm.startsAt, endsAt: freeForm.endsAt }])
        setFreeForm({ startsAt: "15:00", endsAt: "18:00" })
      }
    } catch (error) {
      setFreeError(error.message)
    } finally {
      setFreeBusy(false)
    }
  }

  function shift(delta) {
    const next = new Date(year, month + delta, 1)
    onYearMonth(next.getFullYear(), next.getMonth())
    setSelected(null)
    resetForm()
  }

  function goToday() {
    const now = new Date()
    onYearMonth(now.getFullYear(), now.getMonth())
    setSelected(null)
    resetForm()
  }

  function pickDay(key) {
    setSelected((current) => (current === key ? null : key))
    resetForm()
  }

  function openOwn() {
    setEditingId(null)
    setFormError({})
    setOwnError("")
    setFreeDraft(null)
    setFreeError("")
    setIntent("own")
  }

  function openLesson() {
    setOwnId(null)
    setOwnError("")
    setFreeDraft(null)
    setFreeError("")
    setIntent((current) => (current === "trial" || current === "student" ? current : null))
  }

  function startAdd(kind) {
    const now = new Date()
    onYearMonth(now.getFullYear(), now.getMonth())
    setSelected(today)
    setEditingId(null)
    setOwnId(null)
    setConfirmId(null)
    setOwnConfirm(null)
    setFormError({})
    setOwnError("")
    setPayError("")
    setFreeDraft(null)
    setFreeError("")
    setForm({ ...EMPTY_FORM, kind })
    setIntent(kind === "probna" ? "trial" : "student")
    requestAnimationFrame(() => {
      document.getElementById("day-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function startOwn() {
    const now = new Date()
    onYearMonth(now.getFullYear(), now.getMonth())
    setSelected(today)
    resetForm()
    setIntent("own")
    requestAnimationFrame(() => {
      document.getElementById("day-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function editOwn(event) {
    setSelected(event.date)
    setEditingId(null)
    setOwnId(event.id)
    setOwn({ title: event.title, startsAt: event.startsAt, endsAt: event.endsAt })
    setOwnError("")
    setOwnConfirm(null)
    setFreeDraft(null)
    setFreeError("")
    setIntent("own")
    requestAnimationFrame(() => {
      document.getElementById("day-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function editLesson(lesson) {
    setSelected(lesson.date)
    setEditingId(lesson.id)
    setOwnId(null)
    setFreeDraft(null)
    setFreeError("")
    setIntent(null)
    setForm({
      studentName: lesson.studentName,
      discord: lesson.discord,
      startsAt: lesson.startsAt || "16:00",
      duration: lesson.duration,
      kind: lesson.kind,
      level: lesson.level,
    })
    setFormError({})
    setConfirmId(null)
    requestAnimationFrame(() => {
      document.getElementById("day-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  async function removeLesson(id) {
    setSaving(true)
    try {
      await onDelete(id)
      if (editingId === id) resetForm()
      setConfirmId(null)
    } catch (error) {
      setFormError({ form: error.message || "Nie udało się usunąć lekcji." })
      setConfirmId(null)
    } finally {
      setSaving(false)
    }
  }

  async function removeOwn(id) {
    setSaving(true)
    setOwnError("")
    try {
      await onDeletePersonal(id)
      if (ownId === id) resetForm()
      setOwnConfirm(null)
    } catch (error) {
      setOwnError(error.message || "Nie udało się usunąć własnych zajęć.")
      setOwnConfirm(null)
    } finally {
      setSaving(false)
    }
  }

  async function submitOwn(event) {
    event.preventDefault()
    if (saving || !selected) return
    const title = own.title.trim()
    if (!title) {
      setOwnError("Podaj nazwę, na przykład lekarz albo trening.")
      return
    }
    if (!own.startsAt || !own.endsAt || own.endsAt <= own.startsAt) {
      setOwnError("Godzina końca musi być późniejsza niż początek.")
      return
    }
    setSaving(true)
    setOwnError("")
    const payload = { date: selected, title, startsAt: own.startsAt, endsAt: own.endsAt }
    try {
      if (ownId) await onUpdatePersonal(ownId, payload)
      else await onCreatePersonal(payload)
      resetForm()
    } catch (error) {
      setOwnError(error.message || "Nie udało się zapisać własnych zajęć.")
    } finally {
      setSaving(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const studentName = form.studentName.trim()
    const discord = form.discord.trim()
    const nextError = {}
    if (!studentName) nextError.studentName = "Podaj imię."
    if (!discord) nextError.discord = "Podaj nazwę na Discordzie."
    if (!form.startsAt) nextError.startsAt = "Podaj godzinę rozpoczęcia."
    setFormError(nextError)
    if (Object.keys(nextError).length || !selected) return

    const payload = {
      date: selected,
      studentName,
      discord,
      startsAt: form.startsAt,
      duration: Number(form.duration),
      kind: form.kind,
      level: form.level,
    }

    setSaving(true)
    try {
      if (editingId) await onUpdate(editingId, payload)
      else await onCreate(payload)
      resetForm()
    } catch (error) {
      setFormError({ form: error.message || "Nie udało się zapisać lekcji." })
    } finally {
      setSaving(false)
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (formError[field]) {
      setFormError((current) => ({ ...current, [field]: undefined }))
    }
  }

  const entryMode = intent === "own" ? "own" : intent === "free" ? "free" : "lesson"
  const showComposer = canEdit || Boolean(freeDraft?.id) || (canEditLessons && Boolean(editingId))
  const splitDay = showComposer && dayEntries.length > 0
  const composerClass = cx(
    "grid content-start gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2",
    splitDay && "lg:border-t-0 lg:pt-0 lg:border-l lg:pl-8",
  )

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => startAdd("zwykla")}
            className="w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900"
          >
            Dodaj ucznia
          </button>
          <button
            type="button"
            onClick={() => startAdd("probna")}
            className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
          >
            Dodaj lekcję próbną
          </button>
          <button
            type="button"
            onClick={startOwn}
            className="col-span-2 w-full rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-100"
          >
            Dodaj własne
          </button>
        </div>
      )}
      <section id="calendar-board" className="rounded-3xl border border-stone-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">{monthTitle(year, month)}</h2>
            <p className="text-sm text-stone-500">
              {names.join(", ")} · {monthLessons.length} {lessonsLabel(monthLessons.length)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Dziś
            </button>
            <button
              type="button"
              aria-label="Poprzedni miesiąc"
              onClick={() => shift(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-lg text-stone-700 transition hover:bg-stone-50"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Następny miesiąc"
              onClick={() => shift(1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-lg text-stone-700 transition hover:bg-stone-50"
            >
              ›
            </button>
          </div>
        </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={cx(
                "pb-1 text-center text-[11px] font-semibold uppercase tracking-wide sm:text-xs",
                index >= 5 ? "text-stone-400" : "text-stone-500",
              )}
            >
              {day}
            </div>
          ))}
          {cells.map((day, index) => {
            if (day == null) return <div key={`empty-${index}`} />
            const key = dateKey(year, month, day)
            const items = byDate.get(key) ?? []
            const slots = slotsByDate.get(key) ?? []
            const ownItems = personalByDate.get(key) ?? []
            const isSelected = selected === key
            const isToday = key === today
            const weekend = index % 7 >= 5
            const payCounts = canMarkPayment ? dayPayCounts(items) : []
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${day}, ${items.length} ${lessonsLabel(items.length)}, ${slots.length} wolnych`}
                onClick={() => pickDay(key)}
                className={cx(
                  "flex min-h-16 flex-col rounded-xl border p-1 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 sm:min-h-28 sm:rounded-2xl sm:p-2",
                  isSelected
                    ? "border-teal-800 bg-teal-50 shadow-sm"
                    : weekend
                      ? "border-stone-200 bg-stone-50 hover:border-stone-300"
                      : "border-stone-200 bg-white hover:border-stone-300",
                )}
              >
                <span className="inline-flex items-center gap-1">
                  <span
                    className={cx(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isToday ? "bg-teal-800 text-white" : "text-stone-800",
                    )}
                  >
                    {day}
                  </span>
                  {payCounts.map((mark) => (
                    <span key={mark.key} className={cx("text-[10px] font-bold leading-none whitespace-nowrap sm:text-xs", mark.className)}>
                      {mark.count > 1 ? `${mark.count}x` : "x"}
                    </span>
                  ))}
                </span>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {(() => {
                    const chips = [
                      ...items.map((lesson) => ({
                        id: lesson.id,
                        start: lesson.startsAt || "99:99",
                        lesson,
                      })),
                      ...ownItems.map((event) => ({
                        id: event.id,
                        start: event.startsAt || "99:99",
                        event,
                      })),
                      ...slots.map((slot) => ({
                        id: slot.id,
                        start: slot.startsAt,
                        slot,
                      })),
                    ].sort((a, b) => a.start.localeCompare(b.start))
                    const visible = chips.slice(0, 3)
                    return (
                      <>
                        {visible.map((chip) =>
                          chip.event ? (
                            <div
                              key={chip.id}
                              title={chip.event.title}
                              className="flex h-5 items-center overflow-hidden rounded-md bg-indigo-100 px-1.5 text-[11px] font-medium leading-none text-ellipsis whitespace-nowrap text-indigo-950"
                            >
                              {chip.event.startsAt}–{chip.event.endsAt} {chip.event.title}
                            </div>
                          ) : chip.lesson ? (
                            <motion.div
                              key={chip.id}
                              title={`${lessonSpan(chip.lesson) || chip.lesson.studentName} · ${chip.lesson.studentName}${several ? ` · ${chip.lesson.tutor}` : ""}`}
                              className={cx(
                                "flex h-5 items-center gap-1 overflow-hidden rounded-md px-1.5 text-[11px] font-medium leading-none",
                                awaitsHeldMark(chip.lesson, today) && "animate-pulse",
                                lessonChip(chip.lesson),
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {lessonSpan(chip.lesson) ? `${lessonSpan(chip.lesson)} ` : ""}
                                {chip.lesson.studentName}
                                {several ? ` · ${chip.lesson.tutor}` : ""}
                              </span>
                            </motion.div>
                          ) : (
                            <div
                              key={chip.id}
                              className="flex h-5 items-center overflow-hidden rounded-md bg-sky-100 px-1.5 text-[11px] font-medium leading-none text-ellipsis whitespace-nowrap text-sky-950"
                            >
                              {chip.slot.startsAt}–{chip.slot.endsAt}
                              {several ? ` ${chip.slot.tutor}` : ""}
                            </div>
                          ),
                        )}
                        {chips.length > visible.length && (
                          <div
                            className={cx(
                              "flex h-5 items-center px-1 text-[11px] font-medium leading-none text-stone-500",
                              chips.slice(3).some((chip) => chip.lesson && awaitsHeldMark(chip.lesson, today)) && "animate-pulse",
                            )}
                          >
                            +{chips.length - visible.length}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
                <div className="mt-auto flex flex-wrap gap-1 pt-1 sm:hidden">
                  {items.length > 0 && items.length <= 4 ? (
                    items.map((lesson) => (
                      <span key={lesson.id} className={cx("inline-flex items-center gap-px", awaitsHeldMark(lesson, today) && "animate-pulse")}>
                        <span
                          className={cx(
                            "h-1.5 w-1.5 rounded-full",
                            lesson.held === false ? "bg-stone-400" : lesson.kind === "probna" ? "bg-amber-500" : "bg-teal-700",
                          )}
                        />
                      </span>
                    ))
                  ) : items.length > 4 ? (
                    <span className={cx("text-[10px] font-semibold text-teal-800", items.some((lesson) => awaitsHeldMark(lesson, today)) && "animate-pulse")}>
                      {items.length}
                    </span>
                  ) : null}
                  {ownItems.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                  {slots.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-sm bg-sky-500" />
                  )}
                </div>
              </button>
            )
          })}
                </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-700" />
            Zwykła
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Próbna
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-stone-400" />
            Nie odbyły się
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Własne
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-sky-500" />
            Wolne
          </span>
          {canMarkPayment && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-xs font-bold leading-none text-[#8B5A2B]">x</span>
                Uczeń nie zapłacił
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-xs font-bold leading-none text-red-600">x</span>
                Korepetytor nieopłacony
              </span>
            </>
          )}
        </div>
      </section>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.section
            id="day-panel"
            key={selected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-stone-900">{formatDay(selected)}</h3>
              <p className="text-right text-sm font-medium text-stone-800">
                <time dateTime={now.toISOString()}>{formatNow(now)}</time>
                <span className="mt-0.5 block text-xs font-normal text-stone-500">teraźniejsza data</span>
              </p>
            </div>
            {formError.form && <p className="mt-2 text-sm text-red-700">{formError.form}</p>}
            {payError && <p className="mt-2 text-sm text-red-700">{payError}</p>}
            <div className="mt-4">
              {canEdit && !editingId && !ownId && (
                <div className="mb-4 hidden lg:block">
                  <EntrySwitch mode={entryMode} onLesson={openLesson} onOwn={openOwn} onFree={openFree} />
                </div>
              )}
              <div className={cx("grid items-start gap-6", splitDay && "lg:grid-cols-2 lg:gap-8")}>
              {(dayEntries.length > 0 || !showComposer) && (
              <div className="flex flex-col gap-3">
                {dayEntries.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-3 text-center text-sm text-stone-500">
                    Brak zajęć w tym dniu.
                  </p>
                )}
                <AnimatePresence initial={false}>
                  {dayEntries.map((entry) =>
                    entry.kind === "pause" ? (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex h-11 items-center justify-between gap-3 rounded-2xl border border-stone-300 bg-stone-200 px-3 text-sm font-medium text-stone-700"
                      >
                        <span className="truncate">
                          {entry.pause.minutes === 0
                            ? `0 minut${several ? ` · ${entry.pause.tutor}` : ""}`
                            : `${entry.pause.startsAt}–${entry.pause.endsAt}${several ? ` · ${entry.pause.tutor}` : ""} · Przerwa`}
                        </span>
                        {((entry.pause.followerKind === "own" && onUpdatePersonal) ||
                          (entry.pause.followerKind === "lesson" && onUpdate)) && (
                          <BreakLength
                            minutes={entry.pause.minutes}
                            max={entry.pause.max}
                            busy={breakBusy === entry.id}
                            onChange={(minutes) => setBreak(entry.pause, minutes)}
                          />
                        )}
                      </motion.div>
                    ) : entry.kind === "slot" ? (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cx(
                          "flex h-11 items-center justify-between gap-3 rounded-2xl border px-3 text-sm font-medium text-sky-950",
                          freeDraft?.id === entry.slot.id ? "border-sky-700 bg-sky-100" : "border-sky-200 bg-sky-50",
                        )}
                      >
                        <span className="truncate leading-none">
                          {entry.slot.startsAt}–{entry.slot.endsAt}
                          {several ? ` · ${entry.slot.tutor}` : ""}
                        </span>
                        {onUpdateFree && (
                          <button
                            type="button"
                            onClick={() => beginFreeEdit(entry.slot)}
                            className="shrink-0 text-sm font-medium text-sky-800"
                          >
                            Edytuj
                          </button>
                        )}
                      </motion.div>
                    ) : entry.kind === "own" ? (
                      <motion.article
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cx(
                          "rounded-2xl border px-3 py-3",
                          ownId === entry.event.id ? "border-indigo-700 bg-indigo-50" : "border-indigo-200 bg-indigo-50/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-stone-900">{entry.event.title}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                              <span>
                                {entry.event.startsAt}–{entry.event.endsAt}
                              </span>
                              <Badge tone="violet">Własne</Badge>
                            </p>
                          </div>
                          {canEdit && (
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => editOwn(entry.event)}
                                className="text-sm font-medium text-indigo-800"
                              >
                                Edytuj
                              </button>
                              {ownConfirm === entry.event.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => removeOwn(entry.event.id)}
                                    className="text-sm font-medium text-red-700"
                                  >
                                    Usuń
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOwnConfirm(null)}
                                    className="text-sm text-stone-500"
                                  >
                                    Anuluj
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setOwnConfirm(entry.event.id)}
                                  className="text-sm font-medium text-stone-500 hover:text-red-700"
                                >
                                  Usuń
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.article>
                    ) : (
                      (() => {
                        const lesson = entry.lesson
                        return (
                    <motion.article
                      key={lesson.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cx(
                        "rounded-2xl border px-3 py-3",
                        editingId === lesson.id ? "border-teal-800 bg-teal-50" : "border-stone-200",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900">{lesson.studentName}</p>
                          {several && <p className="text-xs font-medium text-teal-800">{lesson.tutor}</p>}
                          <p className="truncate text-sm text-stone-500">Discord: {lesson.discord}</p>
                        </div>
                        {(canEdit || canEditLessons) && (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => editLesson(lesson)}
                              className="text-sm font-medium text-teal-800"
                            >
                              Edytuj
                            </button>
                            {canEdit &&
                              (confirmId === lesson.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => removeLesson(lesson.id)}
                                    className="text-sm font-medium text-red-700"
                                  >
                                    Usuń
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmId(null)}
                                    className="text-sm text-stone-500"
                                  >
                                    Anuluj
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmId(lesson.id)}
                                  className="text-sm font-medium text-stone-500 hover:text-red-700"
                                >
                                  Usuń
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone={lesson.kind === "probna" ? "amber" : "teal"}>
                          {labelOf(KINDS, lesson.kind)}
                        </Badge>
                        <Badge>{lessonSpan(lesson) || `${lesson.duration} min`}</Badge>
                        <Badge tone={LEVEL_TONE[lesson.level] ?? "stone"}>
                          {labelOf(LEVELS, lesson.level)}
                        </Badge>
                        {!canEdit && <Badge tone={heldBadge(lesson).tone}>{heldBadge(lesson).text}</Badge>}
                        {canMarkPayment && lesson.held !== false && (
                          <PaymentChecks lesson={lesson} onChange={(patch) => markPaid(lesson, patch)} />
                        )}
                      </div>
                      {canEdit && (
                        <HeldMark
                          held={lesson.held}
                          blink={awaitsHeldMark(lesson, today)}
                          disabled={lesson.date > today}
                          onChange={(held) => markHeld(lesson, held)}
                        />
                      )}
                    </motion.article>
                        )
                      })()
                    ),
                  )}
                </AnimatePresence>
              </div>
              )}
              {dayEntries.length === 0 && showComposer && (
                <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-3 text-center text-sm text-stone-500">
                  Brak zajęć w tym dniu.
                </p>
              )}

              {showComposer && entryMode === "own" ? (
                <form onSubmit={submitOwn} className={composerClass}>
                  <ComposerHeading title={ownId ? "Edycja własnych zajęć" : "Własne zajęcia"}>
                    {canEdit && !editingId && !ownId && (
                      <EntrySwitch compact mode={entryMode} onLesson={openLesson} onOwn={openOwn} onFree={openFree} />
                    )}
                  </ComposerHeading>
                  <p className="text-sm text-stone-500 sm:col-span-2">Widoczne tylko u Ciebie.</p>
                  {ownError && <p className="text-sm text-red-700 sm:col-span-2">{ownError}</p>}
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Nazwa</span>
                    <input
                      value={own.title}
                      onChange={(event) => setOwn((current) => ({ ...current, title: event.target.value }))}
                      placeholder="np. Lekarz, trening"
                      maxLength={80}
                      autoComplete="off"
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-indigo-700 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Od</span>
                    <input
                      type="time"
                      value={own.startsAt}
                      onChange={(event) => setOwn((current) => ({ ...current, startsAt: event.target.value }))}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-indigo-700 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Do</span>
                    <input
                      type="time"
                      value={own.endsAt}
                      onChange={(event) => setOwn((current) => ({ ...current, endsAt: event.target.value }))}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-indigo-700 focus:ring-2"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-indigo-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-60"
                    >
                      {saving ? "Zapisywanie…" : ownId ? "Zapisz zmiany" : "Dodaj"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
                    >
                      Anuluj
                    </button>
                  </div>
                </form>
              ) : showComposer && entryMode === "free" ? (
                <form onSubmit={saveFree} className={composerClass}>
                  <ComposerHeading title={freeDraft?.id ? "Edycja wolnych godzin" : "Wolne godziny"}>
                    {canEdit && !editingId && !ownId && (
                      <EntrySwitch compact mode={entryMode} onLesson={openLesson} onOwn={openOwn} onFree={openFree} />
                    )}
                  </ComposerHeading>
                  <p className="text-sm text-stone-500 sm:col-span-2">Na wybrany dzień.</p>
                  {freeError && <p className="text-sm text-red-700 sm:col-span-2">{freeError}</p>}
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Od</span>
                    <input
                      type="time"
                      value={freeForm.startsAt}
                      onChange={(event) => setFreeForm((current) => ({ ...current, startsAt: event.target.value }))}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-sky-700 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Do</span>
                    <input
                      type="time"
                      value={freeForm.endsAt}
                      onChange={(event) => setFreeForm((current) => ({ ...current, endsAt: event.target.value }))}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-sky-700 focus:ring-2"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={freeBusy}
                      className="rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:opacity-60"
                    >
                      {freeBusy ? "Zapisywanie…" : freeDraft?.id ? "Zapisz" : "Dodaj"}
                    </button>
                    {freeDraft?.id && (
                      <button
                        type="button"
                        onClick={cancelFreeEdit}
                        className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
                      >
                        Anuluj
                      </button>
                    )}
                  </div>
                </form>
              ) : showComposer ? (
                <form onSubmit={submit} className={composerClass}>
                  <ComposerHeading
                    title={
                      editingId
                        ? "Edycja lekcji"
                        : form.kind === "probna"
                          ? "Nowa lekcja próbna"
                          : intent === "student"
                            ? "Nowy uczeń"
                            : "Nowa lekcja"
                    }
                  >
                    {canEdit && !editingId && !ownId && (
                      <EntrySwitch compact mode={entryMode} onLesson={openLesson} onOwn={openOwn} onFree={openFree} />
                    )}
                  </ComposerHeading>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Imię</span>
                    <input
                      value={form.studentName}
                      onChange={(event) => setField("studentName", event.target.value)}
                      placeholder="np. Anna"
                      maxLength={80}
                      autoComplete="off"
                      aria-invalid={Boolean(formError.studentName)}
                      className={cx(
                        "w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2",
                        formError.studentName ? "border-red-400" : "border-stone-300",
                      )}
                    />
                    {formError.studentName && (
                      <span className="mt-1 block text-xs text-red-700">{formError.studentName}</span>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Nazwa na Discordzie</span>
                    <input
                      value={form.discord}
                      onChange={(event) => setField("discord", event.target.value)}
                      placeholder="np. anna"
                      maxLength={80}
                      autoComplete="off"
                      aria-invalid={Boolean(formError.discord)}
                      className={cx(
                        "w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2",
                        formError.discord ? "border-red-400" : "border-stone-300",
                      )}
                    />
                    {formError.discord && (
                      <span className="mt-1 block text-xs text-red-700">{formError.discord}</span>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Od</span>
                    <input
                      type="time"
                      value={form.startsAt}
                      onChange={(event) => setField("startsAt", event.target.value)}
                      aria-invalid={Boolean(formError.startsAt)}
                      className={cx(
                        "w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2",
                        formError.startsAt ? "border-red-400" : "border-stone-300",
                      )}
                    />
                    {formError.startsAt && (
                      <span className="mt-1 block text-xs text-red-700">{formError.startsAt}</span>
                    )}
                  </label>
                  <div>
                    <ChoiceGroup
                      label="Czas"
                      value={form.duration}
                      options={DURATION_OPTIONS}
                      onChange={(value) => setField("duration", value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <ChoiceGroup
                      label="Rodzaj"
                      value={form.kind}
                      options={KINDS}
                      onChange={(value) => setField("kind", value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <ChoiceGroup
                      label="Poziom"
                      value={form.level}
                      options={LEVELS}
                      onChange={(value) => setField("level", value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
                    >
                      {saving ? "Zapisywanie…" : editingId ? "Zapisz zmiany" : "Dodaj lekcję"}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
                      >
                        Anuluj
                      </button>
                    )}
                  </div>
                </form>
              ) : null}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>


      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-900">Uczniowie</h2>
          <div className="flex gap-1.5">
            {[
              ["miesiac", "Miesiąc"],
              ["rok", "Rok"],
              ["wszystko", "Wszystko"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={studentScope === id}
                onClick={() => setStudentScope(id)}
                className={cx(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  studentScope === id
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={studentScope}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
          >
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            {studentScope === "miesiac"
              ? "W tym miesiącu nie ma uczniów."
              : studentScope === "rok"
                ? "W tym roku nie ma uczniów."
                : "Nie ma jeszcze uczniów."}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {students.map((student) => {
              const draftKey = studentDraft.discord.trim().toLowerCase() || studentDraft.name.trim().toLowerCase()
              const mergeLesson =
                editingStudent === student.key && draftKey && draftKey !== student.key
                  ? lessons.find((lesson) => studentKey(lesson) === draftKey)
                  : null
              return (
              <div
                key={student.key}
                className="flex min-h-32 flex-col rounded-2xl border border-stone-200 bg-white p-3"
              >
                {editingStudent === student.key ? (
                  <motion.form
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    onSubmit={saveStudent}
                    className="space-y-2"
                  >
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-stone-500">Imię</span>
                      <input
                        value={studentDraft.name}
                        onChange={(event) => setStudentDraft((current) => ({ ...current, name: event.target.value }))}
                        maxLength={80}
                        autoComplete="off"
                        className="w-full rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none ring-teal-800 focus:ring-2"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-stone-500">Nazwa na Discordzie</span>
                      <input
                        value={studentDraft.discord}
                        onChange={(event) => setStudentDraft((current) => ({ ...current, discord: event.target.value }))}
                        maxLength={80}
                        autoComplete="off"
                        className="w-full rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none ring-teal-800 focus:ring-2"
                      />
                    </label>
                    {studentError && <p className="text-xs text-red-700">{studentError}</p>}
                    {mergeLesson && (
                      <p className="text-xs text-stone-500">
                        Połączy się z uczniem {mergeLesson.studentName}. Lekcje będą w jednym profilu.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={studentBusy}
                        className="rounded-xl bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
                      >
                        {studentBusy ? "Zapisywanie…" : mergeLesson ? "Połącz" : "Zapisz"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelStudentEdit}
                        className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800"
                      >
                        Anuluj
                      </button>
                    </div>
                  </motion.form>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{student.name}</p>
                      <p className="mt-0.5 truncate text-xs text-stone-500">{student.discord}</p>
                    </div>
                    {onRenameStudent && (
                      <button
                        type="button"
                        onClick={() => beginStudentEdit(student)}
                        className="shrink-0 text-sm font-medium text-teal-800"
                      >
                        Edytuj
                      </button>
                    )}
                  </div>
                )}
                {several && (
                  <p className="mt-0.5 truncate text-xs font-medium text-teal-800">{student.tutors.join(", ")}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {student.levels.map((level) => (
                    <Badge key={level} tone={LEVEL_TONE[level] ?? "stone"}>
                      {labelOf(LEVELS, level)}
                    </Badge>
                  ))}
                </div>
                <p className="mt-auto pt-3 text-base font-semibold text-teal-950">
                  {kindCountLabel(student.regular, "zwykła", "zwykłe", "zwykłych")}
                </p>
                <p className="text-xs font-medium text-stone-400">
                  {kindCountLabel(student.trial, "próbna", "próbne", "próbnych")}
                </p>
                <p className="text-xs text-stone-500">{formatMinutes(student.minutes)}</p>
                <ParentField
                  value={parents[student.key] ?? ""}
                  onSave={(info) => onSaveParent(student.key, info)}
                />
              </div>
              )
            })}
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  )
}
