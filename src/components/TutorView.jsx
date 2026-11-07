import { useState } from "react"
import { AvailabilitySwitch, useFreeAdd } from "./Availability"
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
  personalEvents,
  onCreatePersonal,
  onUpdatePersonal,
  onDeletePersonal,
  parents,
  studentActive,
  onSaveParent,
  onSetStudentActive,
  onRenameStudent,
}) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [day, setDay] = useState(null)
  const [mode, setMode] = useState("plan")
  const mine = lessons.filter((lesson) => lesson.tutor === tutor)
  const freeAdd = useFreeAdd(onCreateFree)

  function focusDay(next) {
    if (!next) {
      setDay(null)
      return
    }
    setDay(next)
    const [nextYear, nextMonth] = next.split("-").map(Number)
    setYear(nextYear)
    setMonth(nextMonth - 1)
  }

  function chooseMode(next) {
    setMode(next)
    if (next === "add") setDay(null)
    else freeAdd.clear()
  }

  return (
    <Shell title={tutor} subtitle="Wpisuj zajęcia" notice={notice} onLogout={onLogout}>
      <div className="mb-4">
        <AvailabilitySwitch taking={taking} onChange={onStatus} />
      </div>
      <ImportantLinks />
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
        studentActive={studentActive}
        onSaveParent={onSaveParent}
        onSetStudentActive={onSetStudentActive}
        onRenameStudent={onRenameStudent}
        onUpdateFree={onUpdateFree}
        onCreateFree={onCreateFree}
        day={day}
        onDayChange={focusDay}
        mode={mode}
        onMode={chooseMode}
        freeAdd={{
          days: freeAdd.days,
          entries: freeAdd.entries,
          onHours: freeAdd.setHours,
          busy: freeAdd.busy,
          error: freeAdd.error,
          saved: freeAdd.saved,
          onToggle: freeAdd.toggle,
          onAdd: async () => {
            const added = await freeAdd.submit()
            if (added) chooseMode("plan")
          },
          onClose: () => chooseMode("plan"),
        }}
      />
    </Shell>
  )
}
