import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { TRIAL_MINUTES, trialSlots } from "../lib/bookings"
import { formatDay, todayKey } from "../lib/store"

const FAQ = [
  {
    question: "Jak zarezerwować próbne zajęcia?",
    answer:
      "Podaj imię, nazwę na Discordzie, mail i numer telefonu, wybierz wolny termin i potwierdź. Ten termin znika z listy, żeby nikt inny go nie zajął.",
  },
  {
    question: "Ile trwają próbne zajęcia?",
    answer: "Próbne zajęcia trwają 60 minut.",
  },
  {
    question: "Z kim będą zajęcia?",
    answer: "Z Tomkiem, Wojtkiem albo Szymonem. Przy każdym terminie widać, kto ma wtedy wolne.",
  },
  {
    question: "Co jeśli nie ma pasującego terminu?",
    answer: "Lista pokazuje tylko aktualnie wolne godziny. Sprawdź później albo napisz na Discordzie.",
  },
  {
    question: "Czy mogę zmienić termin?",
    answer: "Napisz na Discordzie, który podałeś w rezerwacji, i podaj nowy termin.",
  },
  {
    question: "Co w razie problemu?",
    answer: "Napisz lub zadzwoń: 508 810 722 albo 572 166 792.",
  },
]

const FIELD =
  "w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base outline-none ring-teal-800 transition focus:ring-2"

function slotKey(slot) {
  return `${slot.tutor}|${slot.date}|${slot.startsAt}`
}

function FaqList() {
  const [open, setOpen] = useState(0)

  return (
    <div className="flex flex-col gap-2">
      {FAQ.map((item, index) => {
        const active = open === index
        return (
          <div key={item.question} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <button
              type="button"
              aria-expanded={active}
              onClick={() => setOpen(active ? -1 : index)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-stone-900"
            >
              {item.question}
              <span className="text-stone-400">{active ? "–" : "+"}</span>
            </button>
            <AnimatePresence initial={false}>
              {active && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="px-4 pb-4 text-sm leading-6 text-stone-600">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

export default function BookingView({ freeHours, lessons, bookings, statuses, notice, onSubmit, onBack }) {
  const [clock] = useState(() => {
    const now = new Date()
    return { today: todayKey(), minutes: now.getHours() * 60 + now.getMinutes() }
  })
  const [form, setForm] = useState({ studentName: "", discord: "", email: "", phone: "" })
  const [picked, setPicked] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  const slots = trialSlots({
    freeHours,
    lessons,
    bookings,
    statuses,
    today: clock.today,
    nowMinutes: clock.minutes,
  })
  const groups = []
  for (const slot of slots) {
    const last = groups[groups.length - 1]
    if (!last || last.date !== slot.date) groups.push({ date: slot.date, slots: [slot] })
    else last.slots.push(slot)
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError("")
  }

  async function submit(event) {
    event.preventDefault()
    const studentName = form.studentName.trim()
    const discord = form.discord.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()
    const slot = slots.find((item) => slotKey(item) === picked)
    if (!studentName || !discord || !email || !phone) {
      setError("Uzupełnij wszystkie dane.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Podaj poprawny mail.")
      return
    }
    if (phone.replace(/\D/g, "").length < 9) {
      setError("Podaj numer telefonu.")
      return
    }
    if (!slot) {
      setError("Wybierz termin próbnych zajęć.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await onSubmit({
        studentName,
        discord,
        email,
        phone,
        tutor: slot.tutor,
        date: slot.date,
        startsAt: slot.startsAt,
      })
      setDone(slot)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Grafik</p>
          <h1 className="mt-1 text-3xl font-semibold text-stone-900">Korepetycje Mateneza</h1>
          <p className="mt-1 text-sm text-stone-600">Rezerwacja próbnych zajęć</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white"
        >
          Wróć
        </button>
      </header>

      {notice && (
        <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{notice}</p>
      )}

      {done ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-stone-200/70"
        >
          <h2 className="text-xl font-semibold text-stone-900">Termin zapisany</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {formatDay(done.date)}, {done.startsAt}–{done.endsAt}, {done.tutor}. Próbne zajęcia trwają {TRIAL_MINUTES}{" "}
            minut.
          </p>
        </motion.div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-stone-200/70 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900">Twoje dane</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Imię</span>
                  <input
                    required
                    value={form.studentName}
                    onChange={(event) => setField("studentName", event.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Nazwa na Discord</span>
                  <input
                    required
                    value={form.discord}
                    onChange={(event) => setField("discord", event.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Mail</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Nr telefonu</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) => setField("phone", event.target.value)}
                    className={FIELD}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-stone-200/70 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900">Termin na próbne zajęcia</h2>
              {groups.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">Nie ma teraz wolnych terminów.</p>
              ) : (
                <div className="mt-3 flex max-h-80 flex-col gap-4 overflow-y-auto pr-1">
                  {groups.map((group) => (
                    <div key={group.date}>
                      <p className="mb-2 text-sm font-medium text-stone-700">{formatDay(group.date)}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.slots.map((slot) => {
                          const key = slotKey(slot)
                          const active = picked === key
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setPicked(key)
                                if (error) setError("")
                              }}
                              className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                                active
                                  ? "border-teal-800 bg-teal-50 text-teal-950"
                                  : "border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-300"
                              }`}
                            >
                              <span className="block font-medium">
                                {slot.startsAt}–{slot.endsAt}
                              </span>
                              <span className="block text-xs text-stone-500">{slot.tutor}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="mt-4 w-full rounded-2xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
              >
                {saving ? "Zapisywanie…" : "Zarezerwuj"}
              </button>
            </div>
          </div>

          <section className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-stone-200/70 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900">FAQ</h2>
            <div className="mt-4">
              <FaqList />
            </div>
          </section>
        </form>
      )}
    </div>
  )
}
