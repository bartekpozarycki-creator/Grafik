import { useEffect, useRef, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import AdminView from "./components/AdminView"
import LoginScreen from "./components/LoginScreen"
import TutorView from "./components/TutorView"
import {
  createFreeHours,
  deleteFreeHour,
  updateFreeHour,
  emptyStatuses,
  fetchFreeHours,
  fetchStatuses,
  saveTutorStatus,
} from "./lib/availability"
import { createLesson, deleteLesson, fetchLessons, setLessonPaid, updateLesson } from "./lib/lessons"
import { clearSession, loadSession, saveSession } from "./lib/store"

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [lessons, setLessons] = useState([])
  const [freeHours, setFreeHours] = useState([])
  const [statuses, setStatuses] = useState(emptyStatuses)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const revision = useRef(0)
  const screen = !session ? "guest" : !ready ? "loading" : session.name

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

  async function onCreate(tutor, data) {
    const lesson = await createLesson({ ...data, tutor })
    revision.current += 1
    setLessons((current) => [...current, lesson])
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
    const slots = await createFreeHours(entries.map((entry) => ({ ...entry, tutor })))
    revision.current += 1
    setFreeHours((current) => [...current, ...slots])
  }

  async function onUpdateFree(tutor, id, data) {
    const slot = await updateFreeHour(id, tutor, data)
    revision.current += 1
    setFreeHours((current) => current.map((item) => (item.id === id ? slot : item)))
  }

  async function onDeleteFree(tutor, id) {
    await deleteFreeHour(id, tutor)
    revision.current += 1
    setFreeHours((current) => current.filter((slot) => slot.id !== id))
  }

  let view = <LoginScreen onLogin={login} />
  if (session && !ready) {
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
        taking={statuses[session.name] !== false}
        notice={loadError}
        onLogout={logout}
        onCreate={(data) => onCreate(session.name, data)}
        onUpdate={(id, data) => onUpdate(session.name, id, data)}
        onDelete={(id) => onDelete(session.name, id)}
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
