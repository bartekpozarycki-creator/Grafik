import { useState } from "react"
import { AvailabilitySwitch, FreeHours } from "./Availability"
import CalendarBoard from "./CalendarBoard"
import ImportantLinks from "./ImportantLinks"
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
  onLessonHeld,
  onStatus,
  onCreateFree,
  onUpdateFree,
  onDeleteFree,
  personalEvents,
  onCreatePersonal,
  onUpdatePersonal,
  onDeletePersonal,
  parents,
  onSaveParent,
  onRenameStudent,
}) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const mine = lessons.filter((lesson) => lesson.tutor === tutor)

  return (
    <Shell title={tutor} subtitle="Wpisuj zajęcia" notice={notice} onLogout={onLogout}>
      <div className="mb-4">
        <AvailabilitySwitch taking={taking} onChange={onStatus} />
      </div>
      <ImportantLinks />
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
        personalEvents={personalEvents}
        onCreatePersonal={onCreatePersonal}
        onUpdatePersonal={onUpdatePersonal}
        onDeletePersonal={onDeletePersonal}
        parents={parents}
        onSaveParent={onSaveParent}
        onRenameStudent={onRenameStudent}
        onUpdateFree={onUpdateFree}
        onCreateFree={onCreateFree}
      />
    </Shell>
  )
}
