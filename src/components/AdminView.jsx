import { useState } from "react"
import { motion } from "framer-motion"
import { FreeHours, StatusBadge } from "./Availability"
import CalendarBoard from "./CalendarBoard"
import Shell from "./Shell"
import { TUTORS, dateInMonth, formatMinutes, lessonsLabel } from "../lib/store"

function slotsLabel(count) {
  if (count === 1) return "termin"
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "terminy"
  return "terminów"
}

export default function AdminView({
  lessons,
  freeHours,
  statuses,
  notice,
  onLogout,
  onLessonPaid,
  onCreateFree,
  onUpdateFree,
  onDeleteFree,
}) {
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
          const slots = freeHours.filter((slot) => slot.tutor === name).length
          const taking = statuses[name] !== false
          const studentPaidCount = own.filter((lesson) => lesson.studentPaid).length
          const tutorPaidCount = own.filter((lesson) => lesson.tutorPaid).length
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
              <StatusBadge taking={taking} />
              <span className="mt-2 block text-sm text-stone-600">
                Uczeń zapłacił: {studentPaidCount} z {own.length}
              </span>
              <span className="mt-1 block text-sm text-stone-600">
                Korepetytor opłacony: {tutorPaidCount} z {own.length}
              </span>
              <span className="mt-2 block text-sm text-stone-600">
                {formatMinutes(minutes)} · {own.length} {lessonsLabel(own.length)}
              </span>
              <span className="mt-1 block text-sm text-stone-500">
                {slots} {slotsLabel(slots)} wolnych
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
        <FreeHours
          tutor={tutor}
          hours={freeHours}
          canEdit
          onCreate={(entries) => onCreateFree(tutor, entries)}
          onUpdate={(id, data) => onUpdateFree(tutor, id, data)}
          onDelete={(id) => onDeleteFree(tutor, id)}
        />
        <CalendarBoard
          person={tutor}
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
        />
      </motion.div>
    </Shell>
  )
}
