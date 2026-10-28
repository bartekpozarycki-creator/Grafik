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
  isExpiredFreeHour,
  fetchStatuses,
  refitFreeDay,
  saveTutorStatus,
} from "./lib/availability"
import { createLesson, deleteLesson, fetchLessons, renameStudentLessons, setLessonHeld, setLessonPaid, updateLesson } from "./lib/lessons"
import { createPersonalEvent, deletePersonalEvent, fetchPersonalEvents, personalSpan, updatePersonalEvent } from "./lib/personal"
import { deleteParent, fetchParents, parentKey, saveParent } from "./lib/parents"
import { fetchPrices, savePrices } from "./lib/prices"
import { saveTutorRates } from "./lib/rates"
import { forgetThisDevice } from "./lib/push"
import { clearSession, currentPrices, keepSession, loadSession, rememberPrices, rememberTutors, saveSession } from "./lib/store"

export default function App() {
  const [session, setSession] = useState(() => {
    const saved = loadSession()
    if (saved?.role === "admin") rememberTutors(saved.tutors)
    else if (saved?.role === "tutor") rememberTutors([saved])
    return saved
  })
  const [lessons, setLessons] = useState([])
  const [personalEvents, setPersonalEvents] = useState([])
  const [freeHours, setFreeHours] = useState([])
  const [statuses, setStatuses] = useState(emptyStatuses)
  const [closed, setClosed] = useState([])
  const [bookings, setBookings] = useState([])
  const [bookingError, setBookingError] = useState("")
  const [reserving, setReserving] = useState(false)
  const [ready, setReady] = useState(!session)
  const [loadError, setLoadError] = useState("")
  const [parents, setParents] = useState({})
  const [prices, setPrices] = useState(() => currentPrices())
  const [pricesNote, setPricesNote] = useState("")
  const revision = useRef(0)
  const screen = reserving ? "rezerwacja" : !session ? "guest" : !ready ? "loading" : session.name

  useEffect(() => {
    if (!session && !reserving) return undefined

    let cancelled = false
    let requestId = 0
    const names = !session ? [] : session.role === "admin" ? session.tutors.map((item) => item.name) : [session.name]

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
      if (session?.role === "tutor") {
        try {
          const rows = await fetchPersonalEvents(session.name)
          if (isCurrent(id, seen)) setPersonalEvents(rows)
        } catch (error) {
          message = message ? `${message} ${error.message}` : error.message
        }
      } else if (isCurrent(id, seen)) {
        setPersonalEvents([])
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
        const nextParents = await fetchParents()
        if (isCurrent(id, seen)) setParents(nextParents)
      } catch (error) {
        message = message ? `${message} ${error.message}` : error.message
      }
      try {
        const nextPrices = await fetchPrices()
        if (isCurrent(id, seen)) {
          rememberPrices(nextPrices)
          setPrices(nextPrices)
          setPricesNote("")
        }
      } catch (error) {
        if (isCurrent(id, seen)) setPricesNote(error.message)
      }
      try {
        const [hours, nextStatuses] = await Promise.all([fetchFreeHours(), fetchStatuses(names)])
        if (isCurrent(id, seen)) {
          setFreeHours(hours)
          setStatuses(nextStatuses.statuses)
          setClosed(nextStatuses.closed)
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
  }, [session, reserving])

  useEffect(() => {
    const timer = setInterval(() => {
      setFreeHours((current) => {
        const stale = current.filter((slot) => isExpiredFreeHour(slot))
        if (!stale.length) return current
        for (const slot of stale) deleteFreeHour(slot.id, slot.tutor).catch(() => {})
        const gone = new Set(stale.map((slot) => slot.id))
        return current.filter((slot) => !gone.has(slot.id))
      })
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  function login(next, remember) {
    if (next.role === "admin") rememberTutors(next.tutors)
    else rememberTutors([next])
    setReady(false)
    setSession(next)
    saveSession(next, remember)
  }

  async function onSavePrices(next) {
    const saved = await savePrices(next)
    rememberPrices(saved)
    setPrices(saved)
    setPricesNote("")
  }

  async function onSaveRates(next) {
    await saveTutorRates(next)
    setSession((current) => {
      if (!current || current.role !== "admin") return current
      const tutors = current.tutors.map((tutor) =>
        next[tutor.name] == null ? tutor : { ...tutor, pay: next[tutor.name] },
      )
      const updated = { ...current, tutors }
      rememberTutors(tutors)
      keepSession(updated)
      return updated
    })
  }

  function logout() {
    forgetThisDevice().catch(() => {})
    rememberTutors([])
    setReady(true)
    setSession(null)
    clearSession()
    setLessons([])
    setPersonalEvents([])
    setFreeHours([])
    setBookings([])
    setStatuses(emptyStatuses())
    setClosed([])
    setParents({})
  }

  async function onSaveParent(studentKey, info) {
    const saved = await saveParent(studentKey, info)
    setParents((current) => ({ ...current, [studentKey]: saved }))
    return saved
  }

  async function onRenameStudent(fromKey, next) {
    const studentName = next.studentName.trim()
    const discord = next.discord.trim()
    const nextKey = parentKey(discord, studentName)
    const ids = lessons
      .filter((lesson) => {
        const key = parentKey(lesson.discord, lesson.studentName)
        return key === fromKey || key === nextKey
      })
      .map((lesson) => lesson.id)
    const updated = await renameStudentLessons(ids, studentName, discord)
    const byId = new Map(updated.map((lesson) => [lesson.id, lesson]))
    revision.current += 1
    setLessons((current) => current.map((item) => byId.get(item.id) ?? item))
    if (nextKey === fromKey) return
    const kept = String(parents[nextKey] ?? "").trim()
    const extra = String(parents[fromKey] ?? "").trim()
    const merged = !extra || extra === kept ? kept : kept ? `${kept}\n${extra}` : extra
    if (merged !== kept) {
      const saved = await saveParent(nextKey, merged)
      setParents((current) => ({ ...current, [nextKey]: saved }))
    }
    if (extra) {
      await deleteParent(fromKey)
      setParents((current) => {
        const copy = { ...current }
        delete copy[fromKey]
        return copy
      })
    }
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

  async function syncFreeDay(tutor, date, lessonList, eventList) {
    if (!date) return
    const blocks = [
      ...lessonList
        .filter((lesson) => lesson.tutor === tutor && lesson.date === date && lesson.startsAt)
        .map((lesson) => ({
          tutor,
          date,
          startsAt: lesson.startsAt,
          duration: Number(lesson.duration),
        })),
      ...eventList
        .filter((event) => event.tutor === tutor && event.date === date)
        .map((event) => ({
          tutor,
          date,
          startsAt: event.startsAt,
          duration: personalSpan(event),
        })),
    ]
    const slots = await refitFreeDay(tutor, date, blocks)
    if (!slots) return
    revision.current += 1
    setFreeHours((current) => [
      ...current.filter((slot) => slot.tutor !== tutor || slot.date !== date),
      ...slots,
    ])
  }

  async function onUpdate(tutor, id, data) {
    const previous = lessons.find((item) => item.id === id)
    const lesson = await updateLesson(id, tutor, data)
    revision.current += 1
    const nextLessons = lessons.map((item) => (item.id === id ? lesson : item))
    setLessons(nextLessons)
    try {
      const dates = [...new Set([previous?.date, lesson.date].filter(Boolean))]
      for (const date of dates) await syncFreeDay(tutor, date, nextLessons, personalEvents)
    } catch (error) {
      setLoadError(error.message)
    }
  }

  async function onDelete(tutor, id) {
    await deleteLesson(id, tutor)
    revision.current += 1
    setLessons((current) => current.filter((item) => item.id !== id))
  }

  async function onCreatePersonal(tutor, data) {
    const event = await createPersonalEvent({ ...data, tutor })
    revision.current += 1
    setPersonalEvents((current) => [...current, event])
    try {
      await punchFreeTime(tutor, { date: event.date, startsAt: event.startsAt, duration: personalSpan(event) })
    } catch (error) {
      setLoadError(error.message)
    }
  }

  async function onUpdatePersonal(tutor, id, data) {
    const previous = personalEvents.find((item) => item.id === id)
    const event = await updatePersonalEvent(id, tutor, data)
    revision.current += 1
    const nextEvents = personalEvents.map((item) => (item.id === id ? event : item))
    setPersonalEvents(nextEvents)
    try {
      const dates = [...new Set([previous?.date, event.date].filter(Boolean))]
      for (const date of dates) await syncFreeDay(tutor, date, lessons, nextEvents)
    } catch (error) {
      setLoadError(error.message)
    }
  }

  async function onDeletePersonal(tutor, id) {
    await deletePersonalEvent(id, tutor)
    revision.current += 1
    setPersonalEvents((current) => current.filter((item) => item.id !== id))
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
    const blocks = [
      ...lessons.filter((lesson) => lesson.tutor === tutor),
      ...personalEvents
        .filter((event) => event.tutor === tutor)
        .map((event) => ({ ...event, duration: personalSpan(event) })),
    ]
    const slots = await addFreeHours(
      entries.map((entry) => ({ ...entry, tutor })),
      blocks,
    )
    const dates = new Set(entries.map((entry) => entry.date))
    revision.current += 1
    setFreeHours((current) => [
      ...current.filter((slot) => slot.tutor !== tutor || !dates.has(slot.date)),
      ...slots,
    ])
  }

  async function onUpdateFree(tutor, id, data) {
    const blocks = [
      ...lessons.filter((lesson) => lesson.tutor === tutor),
      ...personalEvents
        .filter((event) => event.tutor === tutor)
        .map((event) => ({ ...event, duration: personalSpan(event) })),
    ]
    const slots = await changeFreeHour(id, tutor, data, blocks)
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

  let view = (
    <LoginScreen
      onLogin={login}
      onReserve={() => {
        setReady(false)
        setReserving(true)
      }}
    />
  )
  if ((reserving || session) && !ready) {
    view = (
      <div className="flex min-h-svh items-center justify-center text-sm text-stone-500">
        Wczytywanie lekcji…
      </div>
    )
  } else if (reserving) {
    view = (
      <BookingView
        freeHours={freeHours}
        lessons={lessons}
        bookings={bookings}
        statuses={statuses}
        closed={closed}
        notice={bookingError}
        onSubmit={onReserve}
        onBack={() => setReserving(false)}
      />
    )
  } else if (session?.role === "admin") {
    view = (
      <AdminView
        lessons={lessons}
        freeHours={freeHours}
        statuses={statuses}
        notice={loadError}
        onLogout={logout}
        onLessonPaid={onLessonPaid}
        onCreateFree={onCreateFree}
        onUpdateFree={onUpdateFree}
        onDeleteFree={onDeleteFree}
        tutors={session.tutors}
        prices={prices}
        pricesNote={pricesNote}
        onSavePrices={onSavePrices}
        onSaveRates={onSaveRates}
        parents={parents}
        onSaveParent={onSaveParent}
        onRenameStudent={onRenameStudent}
        onUpdateLesson={onUpdate}
      />
    )
  } else if (session) {
    view = (
      <TutorView
        tutor={session.name}
        lessons={lessons}
        freeHours={freeHours}
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
        personalEvents={personalEvents}
        onCreatePersonal={(data) => onCreatePersonal(session.name, data)}
        onUpdatePersonal={(id, data) => onUpdatePersonal(session.name, id, data)}
        onDeletePersonal={(id) => onDeletePersonal(session.name, id)}
        parents={parents}
        onSaveParent={onSaveParent}
        onRenameStudent={onRenameStudent}
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
