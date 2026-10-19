import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { lookupLogin, reserveAllowed } from "../lib/auth"

export default function LoginScreen({ onLogin, onReserve }) {
  const [login, setLogin] = useState("")
  const [code, setCode] = useState("")
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState("")
  const [codeClip, setCodeClip] = useState(true)
  const [gate, setGate] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!gate) setCodeClip(true)
  }, [gate])

  useEffect(() => {
    const value = login.trim()
    if (!value) return undefined
    let cancel = false
    const timer = setTimeout(async () => {
      try {
        const found = await lookupLogin(value)
        if (!cancel) setGate(found?.role === "reserve")
      } catch (reason) {
        if (!cancel) setError(reason.message)
      }
    }, 250)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [login])

  async function submit(event) {
    event.preventDefault()
    setChecking(true)
    try {
      const found = await lookupLogin(login)
      if (found?.role === "reserve") {
        setGate(true)
        if (!code.trim()) {
          setError("Podaj kod.")
          return
        }
        const allowed = await reserveAllowed(login, code)
        if (!allowed) {
          setError("Zły kod.")
          return
        }
        setError("")
        onReserve()
        return
      }
      if (!found) {
        setError("Nie ma takiego loginu.")
        return
      }
      setError("")
      onLogin(found, remember)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <div className="m-auto w-full max-w-md px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-stone-200/70 backdrop-blur sm:p-8"
        >
          <h1 className="text-3xl font-semibold text-stone-900">Grafik Zajęć</h1>
          <p className="mt-2 text-sm text-stone-600">Wpisz login.</p>

          <motion.form
            onSubmit={submit}
            animate={error ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-6"
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Login</span>
              <input
                autoFocus
                autoComplete="off"
                value={login}
                onChange={(event) => {
                  setLogin(event.target.value)
                  setGate(false)
                  setCodeClip(true)
                  setCode("")
                  if (error) setError("")
                }}
                className={`w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none ring-teal-800 transition focus:ring-2 ${
                  error ? "border-red-400" : "border-stone-300"
                }`}
              />
            </label>
            <AnimatePresence initial={false}>
              {gate && (
                <motion.div
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={{
                    open: { height: "auto", opacity: 1 },
                    closed: { height: 0, opacity: 0 },
                  }}
                  transition={{ duration: 0.2 }}
                  onAnimationComplete={(definition) => {
                    if (definition === "open") setCodeClip(false)
                  }}
                  className={codeClip ? "overflow-hidden" : undefined}
                >
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">Podaj kod</span>
                    <input
                      autoComplete="off"
                      inputMode="numeric"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value)
                        if (error) setError("")
                      }}
                      className={`w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none ring-teal-800 transition focus:ring-2 ${
                        error ? "border-red-400" : "border-stone-300"
                      }`}
                    />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="size-4 accent-teal-800"
              />
              Zapamiętaj na tym urządzeniu
            </label>
            <button
              type="submit"
              disabled={checking}
              className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                checking
                  ? "cursor-not-allowed bg-stone-200 text-stone-400"
                  : "bg-teal-800 text-white hover:bg-teal-900"
              }`}
            >
              {checking ? "Sprawdzanie…" : "Wejdź"}
            </button>
          </motion.form>
        </motion.div>
      </div>
    </div>
  )
}
