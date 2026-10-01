import { useState } from "react"
import { AvailabilitySwitch, FreeHours } from "./Availability"
import CalendarBoard from "./CalendarBoard"
import Shell from "./Shell"

export default function TutorView({
  tutor,
  lessons,
  freeHours,
  taking,
  notice,
  onLogout,
  onCreate,
  onUpdate,
  onDelete,
  onStatus,
  onCreateFree,
  onUpdateFree,
  onDeleteFree,
}) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const mine = lessons.filter((lesson) => lesson.tutor === tutor)

  return (
    <Shell title={tutor} subtitle="Wpisuj odbyte lekcje" notice={notice} onLogout={onLogout}>
      <div className="mb-4">
        <AvailabilitySwitch taking={taking} onChange={onStatus} />
      </div>
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
      />
    </Shell>
  )
}
