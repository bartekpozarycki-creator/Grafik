import { useState } from "react"
import { motion } from "framer-motion"
import { FreeHours, StatusBadge } from "./Availability"
import CalendarBoard from "./CalendarBoard"
import Reservations from "./Reservations"
import Shell from "./Shell"
import {
  TEST_TUTOR,
  TUTORS,
  dateInMonth,
  formatMinutes,
  formatMoney,
  lessonProfit,
  lessonRevenue,
  lessonsLabel,
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
  bookings,
  bookingNotice,
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
  const [today] = useState(() => todayKey())
  const visible = lessons.filter((lesson) => lesson.tutor === tutor)
  const monthLessons = lessons.filter(
    (lesson) => dateInMonth(lesson.date, year, month) && lesson.date <= today,
  )
  const turnover = moneySum(monthLessons, lessonRevenue)
  const ours = moneySum(monthLessons, lessonProfit)

  return (
    <Shell title="Admin" subtitle="Kalendarz każdego korepetytora" notice={notice} onLogout={onLogout}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Obrót</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{formatMoney(turnover)}</p>
        </div>
        <div className="rounded-2xl border border-teal-800 bg-teal-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">My</p>
          <p className="mt-1 text-2xl font-semibold text-teal-950">{formatMoney(ours)}</p>
        </div>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {TUTORS.map((name) => {
          const own = lessons.filter(
            (lesson) => lesson.tutor === name && dateInMonth(lesson.date, year, month),
          )
          const minutes = own.reduce((sum, lesson) => sum + Number(lesson.duration || 0), 0)
          const students = new Set(
            lessons.filter((lesson) => lesson.tutor === name).map(studentKey),
          ).size
          const slots = freeHours.filter((slot) => slot.tutor === name).length
          const taking = statuses[name] !== false
          const studentPaidCount = own.filter((lesson) => lesson.studentPaid).length
          const tutorPaidCount = own.filter((lesson) => lesson.tutorPaid).length
          const earned = moneySum(
            own.filter((lesson) => lesson.date <= today),
            (lesson) => lessonRevenue(lesson) - lessonProfit(lesson),
          )
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
              <span
                className={`text-xs font-semibold tracking-wide text-stone-500 ${
                  name === TEST_TUTOR ? "" : "uppercase"
                }`}
              >
                {name === TEST_TUTOR ? "konto testowe" : "Korepetytor"}
              </span>
              <span className="mt-1 block text-lg font-semibold text-stone-900">{name}</span>
              <StatusBadge taking={taking} />
              <span className="mt-2 block text-sm font-medium text-stone-800">
                {students} {studentsLabel(students)}
              </span>
              {name !== TEST_TUTOR && (
                <span className="mt-1 block text-sm font-medium text-stone-900">Zarobił {formatMoney(earned)}</span>
              )}
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
      <Reservations bookings={bookings} notice={bookingNotice} />
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
