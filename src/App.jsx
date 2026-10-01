import { useEffect, useRef, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import AdminView from "./components/AdminView"
import LoginScreen from "./components/LoginScreen"
import TutorView from "./components/TutorView"
import { createLesson, deleteLesson, fetchLessons, updateLesson } from "./lib/lessons"
import { clearSession, loadSession, saveSession } from "./lib/store"

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [lessons, setLessons] = useState([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const revision = useRef(0)
  const screen = !session ? "guest" : !ready ? "loading" : session.name

  useEffect(() => {
    let cancelled = false
    let requestId = 0

    async function load() {
      const id = ++requestId
      const seen = revision.current
      try {
        const rows = await fetchLessons()
        if (cancelled || id !== requestId || seen !== revision.current) return
        setLessons(rows)
        setLoadError("")
      } catch (error) {
        if (cancelled || id !== requestId || seen !== revision.current) return
        setLoadError(error.message)
      } finally {
        if (!cancelled && id === requestId && seen === revision.current) setReady(true)
      }
    }

    load()
    window.addEventListener("focus", load)
    return () => {
      cancelled = true
      window.removeEventListener("focus", load)
    }
  }, [])

  function login(next) {
    setSession(next)
    saveSession(next)
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

  let view = <LoginScreen onLogin={login} />
  if (session && !ready) {
    view = (
      <div className="flex min-h-svh items-center justify-center text-sm text-stone-500">
        Wczytywanie lekcji…
      </div>
    )
  } else if (session?.role === "admin") {
    view = <AdminView lessons={lessons} notice={loadError} onLogout={logout} />
  } else if (session) {
    view = (
      <TutorView
        tutor={session.name}
        lessons={lessons}
        notice={loadError}
        onLogout={logout}
        onCreate={(data) => onCreate(session.name, data)}
        onUpdate={(id, data) => onUpdate(session.name, id, data)}
        onDelete={(id) => onDelete(session.name, id)}
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
