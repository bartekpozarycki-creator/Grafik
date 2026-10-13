import { formatDay } from "./store"
import { supabase } from "./supabase"

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

export function iosNeedsHomeScreen() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
  return ios && !standalone
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

function subscriptionError(error) {
  if (error?.code === "PGRST205" || error?.code === "42P01" || error?.code === "PGRST204") {
    return new Error("Brakuje zapisów powiadomień w Supabase. Uruchom plik supabase/push.sql.")
  }
  return new Error("Nie udało się zapisać powiadomień.")
}

async function saveSubscription(tutor, subscription) {
  const json = subscription.toJSON()
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      tutor,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: "endpoint" },
  )
  if (error) throw subscriptionError(error)
}

function asPushError(error) {
  const message = String(error?.message || "")
  if (/push service not available|Registration failed/i.test(message)) {
    return new Error("To urządzenie nie przyjmuje teraz powiadomień. Włącz je w Chrome na telefonie albo w aplikacji z ekranu głównego.")
  }
  if (error instanceof Error && message) return error
  return new Error("Nie udało się włączyć powiadomień.")
}

async function subscribe(registration) {
  try {
    const existing = await registration.pushManager.getSubscription()
    if (existing) return existing
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  } catch (error) {
    throw asPushError(error)
  }
}

async function readyRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready
  return registration
}

export async function enablePush(tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  if (!publicKey) throw new Error("Brakuje klucza powiadomień.")
  if (!pushSupported()) throw new Error("Ta przeglądarka nie obsługuje powiadomień.")
  if (iosNeedsHomeScreen()) {
    throw new Error("Na iPhonie dodaj aplikację na ekran główny i otwórz ją z ikony.")
  }
  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Nie ma zgody na powiadomienia.")
  const registration = await readyRegistration()
  await saveSubscription(tutor, await subscribe(registration))
}

export async function refreshPush(tutor) {
  if (!supabase || !publicKey || !pushSupported()) return false
  if (Notification.permission !== "granted" || iosNeedsHomeScreen()) return false
  const registration = await readyRegistration()
  await saveSubscription(tutor, await subscribe(registration))
  return true
}

export async function forgetThisDevice() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint)
  await subscription.unsubscribe()
}

export async function notifyTutor(booking) {
  if (!supabase || !booking?.tutor) return
  await supabase.functions.invoke("notify-booking", {
    body: {
      tutor: booking.tutor,
      title: "Nowa rezerwacja",
      body: `${booking.studentName} · ${formatDay(booking.date)}, ${booking.startsAt}`,
    },
  })
}
