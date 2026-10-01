import { useState } from "react"
import { motion } from "framer-motion"
import CalendarBoard from "./CalendarBoard"
import Shell from "./Shell"
import { TUTORS, dateInMonth, formatMinutes, lessonsLabel } from "../lib/store"

export default function AdminView({ lessons, notice, onLogout }) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [tutor, setTutor] = useState(TUTORS[0])
  const visible = lessons.filter((lesson) => lesson.tutor === tutor)

  return (
    <Shell title="Admin" subtitle="Kalendarz każdego korepetytora" notice={notice} onLogout={onLogout}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {TUTORS.map((name) => {
          const own = lessons.filter(
            (lesson) => lesson.tutor === name && dateInMonth(lesson.date, year, month),
          )
          const minutes = own.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0)
          const active = name === tutor
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTutor(name)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                active
                  ? "border-teal-800 bg-teal-50 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Korepetytor
              </span>
              <span className="mt-1 block text-lg font-semibold text-stone-900">{name}</span>
              <span className="mt-2 block text-sm text-stone-600">
                {formatMinutes(minutes)} · {own.length} {lessonsLabel(own.length)}
              </span>
            </button>
          )
        })}
      </div>
      <motion.div
        key={tutor}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <CalendarBoard
          person={tutor}
          year={year}
          month={month}
          onYearMonth={(nextYear, nextMonth) => {
            setYear(nextYear)
            setMonth(nextMonth)
          }}
          lessons={visible}
          canEdit={false}
        />
      </motion.div>
    </Shell>
  )
}
