import { useState } from "react"
import { motion } from "framer-motion"
import { matchLogin } from "../lib/store"

export default function LoginScreen({ onLogin }) {
  const [login, setLogin] = useState("")
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState("")

  function submit(event) {
    event.preventDefault()
    const next = matchLogin(login)
    if (!next) {
      setError("Nie ma takiego loginu.")
      return
    }
    setError("")
    onLogin(next, remember)
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Grafik</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-900">Szkółka korepetycji</h1>
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
                  if (error) setError("")
                }}
                className={`w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none ring-teal-800 transition focus:ring-2 ${
                  error ? "border-red-400" : "border-stone-300"
                }`}
              />
            </label>
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
              className="mt-4 w-full rounded-2xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              Wejdź
            </button>
          </motion.form>
        </motion.div>
      </div>
    </div>
  )
}
