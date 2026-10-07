import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  DURATIONS,
  KINDS,
  LEVELS,
  WEEKDAYS,
  buildMonthCells,
  dateInMonth,
  dateKey,
  formatDay,
  formatMinutes,
  formatShort,
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

const DURATION_OPTIONS = DURATIONS.map((value) => ({ id: value, label: `${value} min` }))

const LEVEL_TONE = {
  podstawa: "stone",
  podstawowka: "sky",
  rozszerzenie: "violet",
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ")
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

function heldBadge(lesson) {
  if (lesson.held === true) return { text: "Odbyły się", tone: "teal" }
  if (lesson.held === false) return { text: "Nie odbyły się", tone: "rose" }
  return { text: "Nieoznaczone", tone: "stone" }
}

function HeldMark({ held, onChange }) {
  const options = [
    { value: true, label: "Odbyły się", active: "border-teal-800 bg-teal-800 text-white" },
    { value: false, label: "Nie odbyły się", active: "border-rose-800 bg-rose-800 text-white" },
  ]
  return (
    <div className="mt-3">
      {held == null && <p className="mb-2 text-xs font-medium text-stone-500">Zaznacz, czy zajęcia się odbyły.</p>}
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = held === option.value
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                if (!selected) onChange(option.value)
              }}
              className={`flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold leading-none transition ${
                selected ? option.active : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
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
      <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
        <input
          type="checkbox"
          checked={lesson.studentPaid}
          onChange={() => onChange({ studentPaid: !lesson.studentPaid })}
          className="accent-teal-800"
        />
        Uczeń zapłacił
      </label>
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

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{value}</div>
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

export default function CalendarBoard({
  person,
  year,
  month,
  onYearMonth,
  lessons,
  freeHours = [],
  canEdit,
  canMarkPayment = false,
  onLessonPaid,
  onLessonHeld,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [payError, setPayError] = useState("")

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
    if (slot.tutor !== person || !dateInMonth(slot.date, year, month)) continue
    const bucket = slotsByDate.get(slot.date)
    if (bucket) bucket.push(slot)
    else slotsByDate.set(slot.date, [slot])
  }
  for (const bucket of slotsByDate.values()) {
    bucket.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }

  const minutes = monthLessons.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0)
  const regular = monthLessons.filter((lesson) => lesson.kind === "zwykla").length
  const trial = monthLessons.filter((lesson) => lesson.kind === "probna").length
  const cells = buildMonthCells(year, month)
  const today = todayKey()
  const dayLessons = selected ? (byDate.get(selected) ?? []) : []
  const daySlots = selected ? (slotsByDate.get(selected) ?? []) : []
  const dayEntries = [
    ...daySlots.map((slot) => ({ kind: "slot", id: slot.id, start: slot.startsAt, slot })),
    ...dayLessons.map((lesson) => ({
      kind: "lesson",
      id: lesson.id,
      start: lesson.startsAt || "99:99",
      lesson,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  async function markHeld(lesson, held) {
    setPayError("")
    try {
      await onLessonHeld(lesson.id, held)
    } catch (error) {
      setPayError(error.message)
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
    setSelected(todayKey())
    resetForm()
  }

  function pickDay(key) {
    setSelected((current) => (current === key ? null : key))
    resetForm()
  }

  function showDay(key) {
    setSelected(key)
    resetForm()
    requestAnimationFrame(() => {
      document.getElementById("day-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function editLesson(lesson) {
    setSelected(lesson.date)
    setEditingId(lesson.id)
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Czas" value={formatMinutes(minutes)} />
        <Stat label="Lekcje" value={monthLessons.length} />
        <Stat label="Zwykłe" value={regular} />
        <Stat label="Próbne" value={trial} />
      </div>

      <div className="flex flex-wrap gap-2">
        {LEVELS.map((level) => {
          const count = monthLessons.filter((lesson) => lesson.level === level.id).length
          return (
            <span
              key={level.id}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200"
            >
              {level.label}: {count}
            </span>
          )
        })}
      </div>

      <section className="rounded-3xl border border-stone-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">{monthTitle(year, month)}</h2>
            <p className="text-sm text-stone-500">
              {person} · {monthLessons.length} {lessonsLabel(monthLessons.length)}
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

        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-7 gap-1 sm:gap-2"
        >
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
            const isSelected = selected === key
            const isToday = key === today
            const weekend = index % 7 >= 5
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
                <span
                  className={cx(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday ? "bg-teal-800 text-white" : "text-stone-800",
                  )}
                >
                  {day}
                </span>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {(() => {
                    const chips = [
                      ...items.map((lesson) => ({
                        id: lesson.id,
                        start: lesson.startsAt || "99:99",
                        lesson,
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
                          chip.lesson ? (
                            <div
                              key={chip.id}
                              title={`${chip.lesson.startsAt ? `${chip.lesson.startsAt} · ` : ""}${chip.lesson.studentName} · ${chip.lesson.duration} min`}
                              className={cx(
                                "flex h-5 items-center overflow-hidden rounded-md px-1.5 text-[11px] font-medium leading-none text-ellipsis whitespace-nowrap",
                                chip.lesson.kind === "probna"
                                  ? "bg-amber-100 text-amber-950"
                                  : "bg-teal-100 text-teal-950",
                              )}
                            >
                              {chip.lesson.startsAt ? `${chip.lesson.startsAt} ` : ""}
                              {chip.lesson.studentName}
                            </div>
                          ) : (
                            <div
                              key={chip.id}
                              className="flex h-5 items-center overflow-hidden rounded-md bg-sky-100 px-1.5 text-[11px] font-medium leading-none text-ellipsis whitespace-nowrap text-sky-950"
                            >
                              {chip.slot.startsAt}–{chip.slot.endsAt}
                            </div>
                          ),
                        )}
                        {chips.length > visible.length && (
                          <div className="flex h-5 items-center px-1 text-[11px] font-medium leading-none text-stone-500">
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
                      <span
                        key={lesson.id}
                        className={cx(
                          "h-1.5 w-1.5 rounded-full",
                          lesson.kind === "probna" ? "bg-amber-500" : "bg-teal-700",
                        )}
                      />
                    ))
                  ) : items.length > 4 ? (
                    <span className="text-[10px] font-semibold text-teal-800">{items.length}</span>
                  ) : null}
                  {slots.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-sm bg-sky-500" />
                  )}
                </div>
              </button>
            )
          })}
        </motion.div>

        <div className="mt-3 flex gap-4 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-700" />
            Zwykła
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Próbna
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-sky-500" />
            Wolne
          </span>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.section
            id="day-panel"
            key={selected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <h3 className="text-lg font-semibold text-stone-900">{formatDay(selected)}</h3>
            {formError.form && <p className="mt-2 text-sm text-red-700">{formError.form}</p>}
            {payError && <p className="mt-2 text-sm text-red-700">{payError}</p>}
            <div className={cx("mt-4 grid gap-6", canEdit && "lg:grid-cols-2")}>
              <div className="space-y-3">
                {dayEntries.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                    Brak lekcji w tym dniu.
                  </p>
                )}
                <AnimatePresence initial={false}>
                  {dayEntries.map((entry) =>
                    entry.kind === "slot" ? (
                      <div
                        key={entry.id}
                        className="flex h-11 items-center rounded-2xl border border-sky-200 bg-sky-50 px-3 text-sm font-medium leading-none text-sky-950"
                      >
                        {entry.slot.startsAt}–{entry.slot.endsAt}
                      </div>
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
                      className={cx(
                        "rounded-2xl border px-3 py-3",
                        editingId === lesson.id ? "border-teal-800 bg-teal-50" : "border-stone-200",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900">{lesson.studentName}</p>
                          <p className="truncate text-sm text-stone-500">Discord: {lesson.discord}</p>
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => editLesson(lesson)}
                              className="text-sm font-medium text-teal-800"
                            >
                              Edytuj
                            </button>
                            {confirmId === lesson.id ? (
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
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone={lesson.kind === "probna" ? "amber" : "teal"}>
                          {labelOf(KINDS, lesson.kind)}
                        </Badge>
                        <Badge>{lesson.startsAt ? `${lesson.startsAt} · ` : ""}{lesson.duration} min</Badge>
                        <Badge tone={LEVEL_TONE[lesson.level] ?? "stone"}>
                          {labelOf(LEVELS, lesson.level)}
                        </Badge>
                        {!canEdit && <Badge tone={heldBadge(lesson).tone}>{heldBadge(lesson).text}</Badge>}
                        {canMarkPayment && (
                          <PaymentChecks lesson={lesson} onChange={(patch) => markPaid(lesson, patch)} />
                        )}
                      </div>
                      {canEdit && <HeldMark held={lesson.held} onChange={(held) => markHeld(lesson, held)} />}
                    </motion.article>
                        )
                      })()
                    ),
                  )}
                </AnimatePresence>
              </div>

              {canEdit ? (
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                  <p className="text-sm font-semibold text-stone-800 sm:col-span-2">
                    {editingId ? "Edycja lekcji" : "Nowa lekcja"}
                  </p>
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
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Od</span>
                    <input
                      type="time"
                      value={form.startsAt}
                      onChange={(event) => setField("startsAt", event.target.value)}
                      aria-invalid={Boolean(formError.startsAt)}
                      className={cx(
                        "w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2 sm:max-w-40",
                        formError.startsAt ? "border-red-400" : "border-stone-300",
                      )}
                    />
                    {formError.startsAt && (
                      <span className="mt-1 block text-xs text-red-700">{formError.startsAt}</span>
                    )}
                  </label>
                  <div className="sm:col-span-2">
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
          </motion.section>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-dashed border-stone-300 bg-white/70 px-4 py-6 text-center text-sm text-stone-500"
          >
            {canEdit ? "Kliknij dzień w kalendarzu, żeby wpisać lekcję." : "Kliknij dzień, żeby zobaczyć lekcje."}
          </motion.p>
        )}
      </AnimatePresence>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-900">Ten miesiąc</h2>
        {payError && !selected && <p className="mt-2 text-sm text-red-700">{payError}</p>}
        {monthLessons.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">W tym miesiącu nie ma jeszcze lekcji.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {monthLessons.map((lesson) => (
              <div
                key={lesson.id}
                className={cx(
                  "flex flex-col gap-3 rounded-2xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                  lesson.date === selected ? "border-teal-800 bg-teal-50" : "border-stone-200",
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{lesson.studentName}</p>
                  <p className="truncate text-sm text-stone-500">Discord: {lesson.discord}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => showDay(lesson.date)}
                    className="text-sm font-medium text-teal-800"
                  >
                    {formatShort(lesson.date)}
                  </button>
                  <Badge>{lesson.startsAt ? `${lesson.startsAt} · ` : ""}{lesson.duration} min</Badge>
                  <Badge tone={lesson.kind === "probna" ? "amber" : "teal"}>
                    {labelOf(KINDS, lesson.kind)}
                  </Badge>
                  <Badge tone={LEVEL_TONE[lesson.level] ?? "stone"}>
                    {labelOf(LEVELS, lesson.level)}
                  </Badge>
                  <Badge tone={heldBadge(lesson).tone}>{heldBadge(lesson).text}</Badge>
                  {canMarkPayment && (
                    <PaymentChecks lesson={lesson} onChange={(patch) => markPaid(lesson, patch)} />
                  )}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => editLesson(lesson)}
                        className="text-sm font-medium text-stone-600"
                      >
                        Edytuj
                      </button>
                      {confirmId === lesson.id ? (
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
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
