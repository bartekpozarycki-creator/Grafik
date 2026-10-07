import { useState } from "react"
import { AvailabilitySwitch, FreeHours } from "./Availability"
import CalendarBoard from "./CalendarBoard"
import Reservations from "./Reservations"
import Shell from "./Shell"

export default function TutorView({
  tutor,
  lessons,
  freeHours,
  bookings,
  bookingNotice,
  taking,
  notice,
  onLogout,
  onCreate,
  onUpdate,
  onDelete,
  onLessonHeld,
  onStatus,
  onCreateFree,
  onUpdateFree,
  onDeleteFree,
}) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const mine = lessons.filter((lesson) => lesson.tutor === tutor)

  return (
    <Shell title={tutor} subtitle="Wpisuj zajęcia" notice={notice} onLogout={onLogout}>
      <div className="mb-4">
        <AvailabilitySwitch taking={taking} onChange={onStatus} />
      </div>
      <Reservations bookings={bookings} tutor={tutor} notice={bookingNotice} />
      <FreeHours
        tutor={tutor}
        hours={freeHours}
        canEdit
        onCreate={onCreateFree}
        onUpdate={onUpdateFree}
        onDelete={onDeleteFree}
      />
      <CalendarBoard
        person={tutor}
        year={year}
        month={month}
        onYearMonth={(nextYear, nextMonth) => {
          setYear(nextYear)
          setMonth(nextMonth)
        }}
        lessons={mine}
        freeHours={freeHours}
        canEdit
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onLessonHeld={onLessonHeld}
      />
    </Shell>
  )
}
