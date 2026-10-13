import { useEffect, useState } from "react"
import { enablePush, iosNeedsHomeScreen, pushSupported, refreshPush } from "../lib/push"

export default function PushNotice({ tutor }) {
  const [permission, setPermission] = useState(() =>
    pushSupported() ? Notification.permission : "unsupported",
  )
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const needsInstall = pushSupported() && iosNeedsHomeScreen()

  useEffect(() => {
    let alive = true
    refreshPush(tutor).then(
      (ok) => {
        if (alive && ok) setEnabled(true)
      },
      (reason) => {
        if (alive) setError(reason.message)
      },
    )
    return () => {
      alive = false
    }
  }, [tutor])

  async function turnOn() {
    setError("")
    setSaving(true)
    try {
      await enablePush(tutor)
      setPermission("granted")
      setEnabled(true)
    } catch (reason) {
      setEnabled(false)
      setError(reason.message)
      if (pushSupported()) setPermission(Notification.permission)
    } finally {
      setSaving(false)
    }
  }

  const hint =
    permission === "unsupported"
      ? "Ta przeglądarka nie obsługuje powiadomień."
      : needsInstall
        ? "Na iPhonie dodaj aplikację na ekran główny i otwórz ją z ikony. Potem włącz powiadomienia."
        : enabled
          ? "Włączone. Nowa rezerwacja przyjdzie na ten telefon."
          : permission === "denied"
            ? "Powiadomienia są zablokowane. Włącz je w ustawieniach przeglądarki dla tej strony."
            : "Gdy ktoś zarezerwuje lekcję, dostaniesz wiadomość na ten telefon."

  return (
    <section className="mb-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900">Powiadomienia o rezerwacjach</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-stone-500">{hint}</p>
        </div>
        {enabled ? (
          <span className="inline-flex h-10 items-center rounded-xl bg-teal-50 px-3 text-sm font-semibold text-teal-900">
            Włączone
          </span>
        ) : (permission === "default" || permission === "granted") && !needsInstall ? (
          <button
            type="button"
            onClick={turnOn}
            disabled={saving}
            className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60"
          >
            {saving ? "Włączanie…" : "Włącz powiadomienia"}
          </button>
        ) : null}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
