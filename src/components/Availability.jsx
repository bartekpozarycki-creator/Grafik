import { useState } from "react"
import { motion } from "framer-motion"
import { addDays, formatShort, todayKey, weeklyDates } from "../lib/store"

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

export function FreeHours({ tutor, hours, canEdit, onCreate, onUpdate, onDelete }) {
  const [date, setDate] = useState(() => todayKey())
  const [startsAt, setStartsAt] = useState("15:00")
  const [endsAt, setEndsAt] = useState("18:00")
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const mine = hours
    .filter((slot) => slot.tutor === tutor)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt))

  function beginEdit(slot) {
    setEditingId(slot.id)
    setDate(slot.date)
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
      <h2 className="text-lg font-semibold text-stone-900">Wolne godziny</h2>
      <p className="mt-1 text-sm text-stone-500">
        {canEdit
          ? "Dodaj dni i godziny. Ten sam przedział możesz powtórzyć co tydzień."
          : `Terminy, w których ${tutor} może brać korepetycje.`}
      </p>
      {canEdit && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Dzień</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
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
                  Do dnia
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
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {mine.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">Nie ma jeszcze wolnych godzin.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {mine.map((slot) => (
            <div
              key={slot.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${
                editingId === slot.id ? "border-teal-800 bg-teal-50" : "border-stone-200"
              }`}
            >
              <p className="text-sm font-medium text-stone-900">
                {formatShort(slot.date)} · {slot.startsAt}–{slot.endsAt}
              </p>
              {canEdit && (
                confirmId === slot.id ? (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => remove(slot.id)} className="text-sm font-medium text-red-700">
                      Usuń
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="text-sm text-stone-500">
                      Anuluj
                    </button>
                  </span>
                ) : (
                  <span className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => beginEdit(slot)}
                      className="text-sm font-medium text-teal-800"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(slot.id)}
                      className="text-sm font-medium text-stone-500 hover:text-red-700"
                    >
                      Usuń
                    </button>
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
