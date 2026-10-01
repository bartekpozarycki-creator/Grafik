import { useState } from "react"
import CalendarBoard from "./CalendarBoard"
import Shell from "./Shell"

export default function TutorView({ tutor, lessons, notice, onLogout, onCreate, onUpdate, onDelete }) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const mine = lessons.filter((lesson) => lesson.tutor === tutor)

  return (
    <Shell title={tutor} subtitle="Wpisuj odbyte lekcje" notice={notice} onLogout={onLogout}>
      <CalendarBoard
        person={tutor}
        year={year}
        month={month}
        onYearMonth={(nextYear, nextMonth) => {
          setYear(nextYear)
          setMonth(nextMonth)
        }}
        lessons={mine}
        canEdit
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </Shell>
  )
}
