import { useEffect, useRef, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import AdminView from "./components/AdminView"
import BookingView from "./components/BookingView"
import LoginScreen from "./components/LoginScreen"
import TutorView from "./components/TutorView"
import { createBooking, fetchBookings } from "./lib/bookings"
import {
  addFreeHours,
  carveFreeHours,
  changeFreeHour,
  createFreeHours,
  deleteFreeHour,
  updateFreeHour,
  emptyStatuses,
  fetchFreeHours,
  fetchStatuses,
  saveTutorStatus,
} from "./lib/availability"
import { createLesson, deleteLesson, fetchLessons, setLessonHeld, setLessonPaid, updateLesson } from "./lib/lessons"
import { clearSession, loadSession, saveSession } from "./lib/store"

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [lessons, setLessons] = useState([])
  const [freeHours, setFreeHours] = useState([])
  const [statuses, setStatuses] = useState(emptyStatuses)
  const [bookings, setBookings] = useState([])
  const [bookingError, setBookingError] = useState("")
  const [reserving, setReserving] = useState(false)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const revision = useRef(0)
  const screen = reserving ? "rezerwacja" : !session ? "guest" : !ready ? "loading" : session.name

  useEffect(() => {
    let cancelled = false
    let requestId = 0

    function isCurrent(id, seen) {
      return !cancelled && id === requestId && seen === revision.current
    }

    async function load() {
      const id = ++requestId
      const seen = revision.current
      let message = ""
      try {
        const rows = await fetchLessons()
        if (isCurrent(id, seen)) setLessons(rows)
      } catch (error) {
        message = error.message
      }
      try {
        const rows = await fetchBookings()
        if (isCurrent(id, seen)) {
          setBookings(rows)
          setBookingError("")
        }
      } catch (error) {
        if (isCurrent(id, seen)) setBookingError(error.message)
      }
      try {
        const [hours, nextStatuses] = await Promise.all([fetchFreeHours(), fetchStatuses()])
        if (isCurrent(id, seen)) {
          setFreeHours(hours)
          setStatuses(nextStatuses)
        }
      } catch (error) {
        message = message ? `${message} ${error.message}` : error.message
      }
      if (isCurrent(id, seen)) {
        setLoadError(message)
        setReady(true)
      }
    }

    load()
    window.addEventListener("focus", load)
    return () => {
      cancelled = true
      window.removeEventListener("focus", load)
    }
  }, [])

  function login(next, remember) {
    setSession(next)
    saveSession(next, remember)
  }

  function logout() {
    setSession(null)
    clearSession()
  }

  async function punchFreeTime(tutor, lesson) {
    if (!lesson.startsAt) return
    const plan = carveFreeHours(freeHours, { ...lesson, tutor })
    if (plan.removeIds.length === 0 && plan.updates.length === 0 && plan.inserts.length === 0) return
    for (const change of plan.updates) await updateFreeHour(change.id, tutor, change)
    const created = plan.inserts.length ? await createFreeHours(plan.inserts) : []
    for (const id of plan.removeIds) await deleteFreeHour(id, tutor)
    const removed = new Set(plan.removeIds)
    const updated = new Map(plan.updates.map((item) => [item.id, item]))
    revision.current += 1
    setFreeHours((current) => [
      ...current
        .filter((slot) => !removed.has(slot.id))
        .map((slot) => (updated.has(slot.id) ? { ...slot, ...updated.get(slot.id) } : slot)),
      ...created,
    ])
  }

  async function onCreate(tutor, data) {
    const lesson = await createLesson({ ...data, tutor })
    revision.current += 1
    setLessons((current) => [...current, lesson])
    try {
      await punchFreeTime(tutor, { ...lesson, startsAt: data.startsAt || lesson.startsAt })
    } catch (error) {
      setLoadError(error.message)
    }
  }

  async function onUpdate(tutor, id, data) {
    const lesson = await updateLesson(id, tutor, data)
    revision.current += 1
    setLessons((current) => current.map((item) => (item.id === id ? lesson : item)))
  }

  async function onDelete(tutor, id) {
    await deleteLesson(id, tutor)
    revision.current += 1
    setLessons((current) => current.filter((item) => item.id !== id))
  }

  async function onLessonHeld(id, held) {
    const lesson = await setLessonHeld(id, held)
    revision.current += 1
    setLessons((current) => current.map((item) => (item.id === id ? lesson : item)))
  }

  async function onLessonPaid(id, patch) {
    const lesson = await setLessonPaid(id, patch)
    revision.current += 1
    setLessons((current) => current.map((item) => (item.id === id ? lesson : item)))
  }

  async function onStatus(tutor, taking) {
    const previous = statuses[tutor] !== false
    revision.current += 1
    setStatuses((current) => ({ ...current, [tutor]: taking }))
    try {
      await saveTutorStatus(tutor, taking)
    } catch (error) {
      revision.current += 1
      setStatuses((current) => ({ ...current, [tutor]: previous }))
      setLoadError(error.message)
    }
  }

  async function onCreateFree(tutor, entries) {
    const slots = await addFreeHours(entries.map((entry) => ({ ...entry, tutor })))
    const dates = new Set(entries.map((entry) => entry.date))
    revision.current += 1
    setFreeHours((current) => [
      ...current.filter((slot) => slot.tutor !== tutor || !dates.has(slot.date)),
      ...slots,
    ])
  }

  async function onUpdateFree(tutor, id, data) {
    const slots = await changeFreeHour(id, tutor, data)
    revision.current += 1
    setFreeHours((current) => [
      ...current.filter((slot) => slot.tutor !== tutor || (slot.date !== data.date && slot.id !== id)),
      ...slots,
    ])
  }

  async function onDeleteFree(tutor, id) {
    await deleteFreeHour(id, tutor)
    revision.current += 1
    setFreeHours((current) => current.filter((slot) => slot.id !== id))
  }

  async function onReserve(data) {
    const booking = await createBooking(data)
    revision.current += 1
    setBookings((current) => [...current, booking])
    try {
      await punchFreeTime(data.tutor, { date: data.date, startsAt: data.startsAt, duration: 60 })
    } catch (error) {
      setLoadError(error.message)
    }
  }

  let view = <LoginScreen onLogin={login} onReserve={() => setReserving(true)} />
  if (reserving) {
    view = (
      <BookingView
        freeHours={freeHours}
        lessons={lessons}
        bookings={bookings}
        statuses={statuses}
        notice={bookingError}
        onSubmit={onReserve}
        onBack={() => setReserving(false)}
      />
    )
  } else if (session && !ready) {
    view = (
      <div className="flex min-h-svh items-center justify-center text-sm text-stone-500">
        Wczytywanie lekcji…
      </div>
    )
  } else if (session?.role === "admin") {
    view = (
      <AdminView
        lessons={lessons}
        freeHours={freeHours}
        statuses={statuses}
        bookings={bookings}
        bookingNotice={bookingError}
        notice={loadError}
        onLogout={logout}
        onLessonPaid={onLessonPaid}
        onCreateFree={onCreateFree}
        onUpdateFree={onUpdateFree}
        onDeleteFree={onDeleteFree}
      />
    )
  } else if (session) {
    view = (
      <TutorView
        tutor={session.name}
        lessons={lessons}
        freeHours={freeHours}
        bookings={bookings}
        bookingNotice={bookingError}
        taking={statuses[session.name] !== false}
        notice={loadError}
        onLogout={logout}
        onCreate={(data) => onCreate(session.name, data)}
        onUpdate={(id, data) => onUpdate(session.name, id, data)}
        onDelete={(id) => onDelete(session.name, id)}
        onLessonHeld={onLessonHeld}
        onStatus={(taking) => onStatus(session.name, taking)}
        onCreateFree={(entries) => onCreateFree(session.name, entries)}
        onUpdateFree={(id, data) => onUpdateFree(session.name, id, data)}
        onDeleteFree={(id) => onDeleteFree(session.name, id)}
      />
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {view}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}
