import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { isExpiredFreeHour } from "../lib/availability"
import { WEEKDAYS, addDays, buildMonthCells, dateKey, formatShort, monthTitle, todayKey, weeklyDates } from "../lib/store"

const WEEKDAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]

function formatClock(date) {
  const day = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
  const time = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(date)
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time}`
}

function MiniMonth({ year, month, selected, picked, marked, onMonth, onPick }) {
  const cells = buildMonthCells(year, month)
  const today = todayKey()
  const busyColumns = new Set()
  cells.forEach((day, index) => {
    if (day != null && marked.has(dateKey(year, month, day))) busyColumns.add(index % 7)
  })
  return (
    <div className="w-full sm:w-96">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900">{monthTitle(year, month)}</p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Poprzedni miesiąc"
            onClick={() => onMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Następny miesiąc"
            onClick={() => onMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            ›
          </button>
        </div>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <span
            key={label}
            className={`text-center text-xs font-semibold ${busyColumns.has(index) ? "text-blue-600" : "text-stone-400"}`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day == null) return <div key={`empty-${index}`} />
          const key = dateKey(year, month, day)
          const active = picked ? picked.has(key) : key === selected
          const isToday = key === today
          const hasHours = marked.has(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              aria-pressed={picked ? picked.has(key) : undefined}
              className={`flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold ${
                active
                  ? hasHours
                    ? "bg-blue-600 text-white"
                    : "bg-teal-800 text-white"
                  : hasHours
                    ? "text-blue-600 hover:bg-blue-50"
                    : isToday
                      ? "bg-stone-200 text-stone-900"
                      : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function toMinutes(value) {
  const [hour, minute] = String(value).split(":").map(Number)
  return hour * 60 + (minute || 0)
}

function fromMinutes(value) {
  const hour = Math.floor(value / 60)
  const minute = value % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (!last || range[0] > last[1]) merged.push([range[0], range[1]])
    else last[1] = Math.max(last[1], range[1])
  }
  return merged
}

function intersectRanges(left, right) {
  const shared = []
  for (const first of left) {
    for (const second of right) {
      const start = Math.max(first[0], second[0])
      const end = Math.min(first[1], second[1])
      if (start < end) shared.push([start, end])
    }
  }
  return mergeRanges(shared)
}

function sharedGroups(slots, tutorNames) {
  const byDate = new Map()
  for (const slot of slots) {
    const bucket = byDate.get(slot.date)
    if (bucket) bucket.push(slot)
    else byDate.set(slot.date, [slot])
  }
  const result = []
  for (const date of [...byDate.keys()].sort()) {
    const daySlots = byDate.get(date)
    const perTutor = tutorNames.map((name) =>
      daySlots
        .filter((slot) => slot.tutor === name)
        .map((slot) => [toMinutes(slot.startsAt), toMinutes(slot.endsAt)]),
    )
    if (perTutor.some((ranges) => ranges.length === 0)) continue
    let shared = mergeRanges(perTutor[0])
    for (const ranges of perTutor.slice(1)) shared = intersectRanges(shared, mergeRanges(ranges))
    if (!shared.length) continue
    result.push({
      date,
      slots: shared.map(([start, end]) => ({ startsAt: fromMinutes(start), endsAt: fromMinutes(end) })),
    })
  }
  return result
}

function hoursText(groups) {
  return groups
    .map((group) => {
      const start = Math.min(...group.slots.map((slot) => toMinutes(slot.startsAt)))
      const end = Math.max(...group.slots.map((slot) => toMinutes(slot.endsAt)))
      return `${weekdayName(group.date).toLowerCase()} ${fromMinutes(start)}-${fromMinutes(end)}`
    })
    .join(", ")
}

function weekdayName(key) {
  const [year, month, day] = key.split("-").map(Number)
  return WEEKDAY_NAMES[(new Date(year, month - 1, day).getDay() + 6) % 7]
}

export function AvailabilitySwitch({ taking, disabled, onChange }) {
  const options = [
    { value: true, label: "Mam wolne godziny, biorę" },
    { value: false, label: "Mam dość, nie biorę" },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = taking === option.value
        return (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`relative rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition disabled:opacity-60 ${
              active
                ? option.value
                  ? "border-teal-800 text-white"
                  : "border-rose-800 text-white"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
            }`}
          >
            {active && (
              <motion.span
                layoutId="availability-status"
                className={`absolute inset-0 rounded-2xl ${option.value ? "bg-teal-800" : "bg-rose-800"}`}
                transition={{ duration: 0.2 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function StatusBadge({ taking }) {
  return (
    <span
      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        taking ? "bg-teal-100 text-teal-900" : "bg-rose-100 text-rose-900"
      }`}
    >
      {taking ? "Biorę" : "Nie biorę"}
    </span>
  )
}

export function FreeHours({ tutor, tutors, hours, canEdit, onCreate, onUpdate, onDelete }) {
  const [date, setDate] = useState(() => todayKey())
  const [startsAt, setStartsAt] = useState("15:00")
  const [endsAt, setEndsAt] = useState("18:00")
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth())
  const [copying, setCopying] = useState(false)
  const [copyDays, setCopyDays] = useState(() => new Set())
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")
  const names = tutors?.length ? tutors : [tutor]
  const allowed = new Set(names)
  const several = names.length > 1
  const mine = hours
    .filter((slot) => allowed.has(slot.tutor) && !isExpiredFreeHour(slot, now.getTime()))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt))
  const ownGroups = []
  for (const slot of mine) {
    const last = ownGroups[ownGroups.length - 1]
    if (!last || last.date !== slot.date) ownGroups.push({ date: slot.date, slots: [slot] })
    else last.slots.push(slot)
  }
  const groups = ownGroups
  const shared = several ? sharedGroups(mine, names) : []
  const marked = new Set(groups.map((group) => group.date))
  const slotCount = groups.reduce((sum, group) => sum + group.slots.length, 0)
  const collapsed = slotCount > 4 && !expanded
  let visibleGroups = groups
  if (collapsed) {
    const kept = []
    let count = 0
    for (const group of groups) {
      if (count >= 4) break
      kept.push(group)
      count += group.slots.length
    }
    for (const group of groups) {
      if ((group.date === date || copyDays.has(group.date)) && !kept.some((item) => item.date === group.date)) {
        kept.push(group)
      }
    }
    visibleGroups = kept.sort((a, b) => a.date.localeCompare(b.date))
  }

  function beginEdit(slot) {
    setEditingId(slot.id)
    chooseDate(slot.date)
    setStartsAt(slot.startsAt)
    setEndsAt(slot.endsAt)
    setRepeat(false)
    setConfirmId(null)
    setError("")
  }

  function cancelEdit() {
    setEditingId(null)
    setError("")
  }

  function chooseDate(next) {
    setDate(next)
    const [year, month] = next.split("-").map(Number)
    setPickerYear(year)
    setPickerMonth(month - 1)
  }

  function pickDay(next) {
    if (copying) {
      if (!marked.has(next)) return
      setCopyDays((current) => {
        const nextDays = new Set(current)
        if (nextDays.has(next)) nextDays.delete(next)
        else nextDays.add(next)
        return nextDays
      })
      setCopied(false)
      setCopyError("")
      return
    }
    chooseDate(next)
    setEditingId(null)
    setConfirmId(null)
    setError("")
  }

  function upcomingDays(count) {
    const today = todayKey()
    return groups.filter((group) => group.date >= today).slice(0, count).map((group) => group.date)
  }

  function pickSpan(count) {
    const days = upcomingDays(count)
    setCopyDays(new Set(days))
    setCopied(false)
    setCopyError("")
    if (days[0]) chooseDate(days[0])
  }

  function spanActive(count) {
    const days = upcomingDays(count)
    return days.length === count && days.length === copyDays.size && days.every((day) => copyDays.has(day))
  }

  async function copyChosen() {
    const chosen = groups.filter((group) => copyDays.has(group.date))
    if (!chosen.length) return
    const text = hoursText(chosen)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement("textarea")
      area.value = text
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.left = "-9999px"
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand("copy")
      area.remove()
      if (!ok) {
        setCopied(false)
        setCopyError("Nie udało się skopiować.")
        return
      }
    }
    setCopied(true)
    setCopyError("")
  }

  function closeCopy() {
    setCopying(false)
    setCopyDays(new Set())
    setCopied(false)
    setCopyError("")
  }

  function shiftPicker(delta) {
    const next = new Date(pickerYear, pickerMonth + delta, 1)
    setPickerYear(next.getFullYear())
    setPickerMonth(next.getMonth())
  }

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

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    if (!date) {
      setError("Wybierz dzień.")
      return
    }
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      setError("Godzina końca musi być późniejsza niż początek.")
      return
    }
    if (!editingId && repeat && (!until || until < date)) {
      setError("Wybierz datę końca powtórzenia, nie wcześniejszą niż początek.")
      return
    }
    const dates = !editingId && repeat ? weeklyDates(date, until) : [date]
    if (!editingId && repeat && addDays(dates[dates.length - 1], 7) <= until) {
      setError("Jedno powtórzenie może mieć najwyżej 40 tygodni.")
      return
    }
    setSaving(true)
    setError("")
    try {
      if (editingId) {
        await onUpdate(editingId, { date, startsAt, endsAt })
        setEditingId(null)
      } else {
        await onCreate(dates.map((day) => ({ date: day, startsAt, endsAt })))
        setRepeat(false)
      }
    } catch (err) {
      setError(err.message || "Nie udało się zapisać wolnych godzin.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    setSaving(true)
    setError("")
    try {
      await onDelete(id)
      setConfirmId(null)
    } catch (err) {
      setError(err.message || "Nie udało się usunąć wolnych godzin.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-stone-900">Wolne godziny</h2>
        <p className="text-right text-sm font-medium text-stone-800">
          {formatClock(now)}
          <span className="mt-0.5 block text-xs font-normal text-stone-500">teraźniejsza data</span>
        </p>
      </div>
      <div className="mt-4 grid items-start gap-4 border-t border-stone-200 pt-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
          <MiniMonth
            year={pickerYear}
            month={pickerMonth}
            selected={copying ? "" : date}
            picked={copying ? copyDays : null}
            marked={marked}
            onMonth={shiftPicker}
            onPick={pickDay}
          />
        </div>
        <div className="min-w-0">
        <div className="rounded-2xl border border-stone-200 p-3 sm:p-4">
          {!canEdit && (
            <p className="text-sm text-stone-500">
              {several
                ? `Wolne godziny: ${names.join(", ")}.`
                : `Terminy, w których ${tutor} może brać korepetycje.`}
            </p>
          )}
          {canEdit && (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">
                    Dzień{date ? ` · ${weekdayName(date)}` : ""}
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => chooseDate(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Od</span>
                  <input
                    type="time"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Do</span>
                  <input
                    type="time"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
                >
                  {saving ? "Zapisywanie…" : editingId ? "Zapisz" : repeat ? "Dodaj terminy" : "Dodaj"}
                </button>
              </div>
              {!editingId && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={repeat}
                      onChange={(event) => {
                        const next = event.target.checked
                        setRepeat(next)
                        if (next && !until) setUntil(addDays(date, 28))
                      }}
                      className="accent-teal-800"
                    />
                    Powtarzaj co tydzień
                  </label>
                  {repeat && (
                    <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                      Do dnia{until ? ` · ${weekdayName(until)}` : ""}
                      <input
                        type="date"
                        min={date}
                        value={until}
                        onChange={(event) => setUntil(event.target.value)}
                        className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none ring-teal-800 focus:ring-2"
                      />
                    </label>
                  )}
                </div>
              )}
              {editingId && (
                <button type="button" onClick={cancelEdit} className="text-sm font-medium text-stone-500">
                  Anuluj edycję
                </button>
              )}
            </form>
          )}
        </div>
        {!copying ? (
          <button
            type="button"
            onClick={() => {
              setCopying(true)
              setCopied(false)
              setCopyError("")
              setCopyDays(new Set())
            }}
            className="mt-3 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
          >
            Skopiuj wolne godziny
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-3"
          >
            <p className="text-sm text-stone-600">Wybierz dni w kalendarzu albo skrót.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={spanActive(count)}
                  onClick={() => pickSpan(count)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    spanActive(count) ? "bg-teal-800 text-white" : "bg-white text-stone-800 hover:bg-stone-100"
                  }`}
                >
                  {count} dni
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyChosen}
                disabled={copyDays.size === 0}
                className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
              >
                Kopiuj
              </button>
              <button type="button" onClick={closeCopy} className="rounded-xl px-3 py-2 text-sm font-medium text-stone-500">
                Anuluj
              </button>
              {copied && <span className="text-sm font-medium text-teal-800">Skopiowano.</span>}
              {copyError && <span className="text-sm text-red-700">{copyError}</span>}
            </div>
          </motion.div>
        )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 border-t border-stone-200 pt-4">
      {several && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-stone-900">Wspólne wolne godziny</p>
          {shared.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Nie ma wspólnych wolnych godzin.</p>
          ) : (
            <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200">
              {shared.map((group) => (
                <li key={group.date} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5">
                  <span className="text-sm font-semibold text-blue-600">
                    {weekdayName(group.date)} · {formatShort(group.date)}
                  </span>
                  {group.slots.map((slot) => (
                    <span key={`${group.date}-${slot.startsAt}`} className="text-sm font-semibold text-stone-900">
                      {slot.startsAt}–{slot.endsAt}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {groups.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nie ma jeszcze wolnych godzin.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200">
          {visibleGroups.map((group) => (
            <motion.li
              key={group.date}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 ${
                copying && copyDays.has(group.date) ? "bg-blue-50" : group.date === date ? "bg-blue-50" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => pickDay(group.date)}
                className="text-sm font-semibold text-blue-600"
              >
                {weekdayName(group.date)} · {formatShort(group.date)}
              </button>
              {group.slots.map((slot) => (
                <span key={slot.id ?? `${group.date}-${slot.startsAt}`} className="inline-flex flex-wrap items-center gap-x-2 text-sm text-stone-800">
                  <span className={`font-semibold ${editingId === slot.id ? "text-blue-700" : "text-stone-900"}`}>
                    {slot.startsAt}–{slot.endsAt}
                    {several && slot.tutor && <span className="ml-1.5 font-medium text-stone-500">{slot.tutor}</span>}
                  </span>
                  {canEdit &&
                    (confirmId === slot.id ? (
                      <>
                        <button type="button" onClick={() => remove(slot.id)} className="text-sm font-medium text-red-700">
                          Usuń
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className="text-sm text-stone-500">
                          Anuluj
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => beginEdit(slot)} className="text-sm font-medium text-teal-800">
                          Edytuj
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(slot.id)}
                          className="text-sm font-medium text-stone-500 hover:text-red-700"
                        >
                          Usuń
                        </button>
                      </>
                    ))}
                </span>
              ))}
            </motion.li>
          ))}
        </ul>
      )}
      {slotCount > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 text-sm font-medium text-teal-800"
        >
          {expanded ? "Zwiń" : `Pokaż wszystkie (${slotCount})`}
        </button>
      )}
      </div>
    </section>
  )
}
