import { TEST_TUTOR } from "./store"
import { supabase } from "./supabase"

export const TRIAL_MINUTES = 60
const BUFFER_MINUTES = 15

function fail(error, fallback) {
  if (error?.code === "PGRST205") {
    throw new Error("Rezerwacje nie są jeszcze gotowe w Supabase. Uruchom plik supabase/bookings.sql.")
  }
  if (error?.code === "23505") {
    throw new Error("Ten termin został właśnie zajęty. Wybierz inny.")
  }
  throw new Error(fallback)
}

function toMinutes(value) {
  const [hour, minute] = String(value).slice(0, 5).split(":").map(Number)
  return hour * 60 + minute
}

function fromMinutes(total) {
  const hour = Math.floor(total / 60)
  const minute = total % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function overlaps(start, end, item) {
  return start < item.end && end > item.start
}

function fromRow(row) {
  return {
    id: row.id,
    studentName: row.student_name,
    discord: row.discord,
    email: row.email,
    phone: row.phone,
    tutor: row.tutor,
    date: String(row.date).slice(0, 10),
    startsAt: String(row.starts_at).slice(0, 5),
    duration: Number(row.duration) || TRIAL_MINUTES,
    createdAt: row.created_at ? Date.parse(row.created_at) : 0,
  }
}

export async function fetchBookings() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("date", { ascending: true })
    .order("starts_at", { ascending: true })
  if (error) fail(error, "Nie udało się wczytać rezerwacji.")
  return (data ?? []).map(fromRow)
}

export async function createBooking(booking) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      student_name: booking.studentName.trim(),
      discord: booking.discord.trim(),
      email: booking.email.trim(),
      phone: booking.phone.trim(),
      tutor: booking.tutor,
      date: booking.date,
      starts_at: `${booking.startsAt}:00`,
      duration: TRIAL_MINUTES,
    })
    .select("*")
    .single()
  if (error) fail(error, "Nie udało się zapisać rezerwacji.")
  return fromRow(data)
}

export function trialSlots({ freeHours, lessons, bookings, statuses, today, nowMinutes }) {
  const taken = []

  for (const lesson of lessons) {
    if (!lesson.startsAt || lesson.tutor === TEST_TUTOR) continue
    const start = toMinutes(lesson.startsAt)
    taken.push({
      tutor: lesson.tutor,
      date: lesson.date,
      start: start - BUFFER_MINUTES,
      end: start + Number(lesson.duration) + BUFFER_MINUTES,
    })
  }

  for (const booking of bookings) {
    const start = toMinutes(booking.startsAt)
    taken.push({
      tutor: booking.tutor,
      date: booking.date,
      start: start - BUFFER_MINUTES,
      end: start + Number(booking.duration || TRIAL_MINUTES) + BUFFER_MINUTES,
    })
  }

  const slots = []
  const blocks = [...freeHours].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.startsAt.localeCompare(right.startsAt) ||
      left.tutor.localeCompare(right.tutor),
  )

  for (const block of blocks) {
    if (block.tutor === TEST_TUTOR || statuses[block.tutor] === false || block.date < today) continue
    let cursor = toMinutes(block.startsAt)
    const blockEnd = toMinutes(block.endsAt)
    while (cursor + TRIAL_MINUTES <= blockEnd) {
      const start = cursor
      const end = cursor + TRIAL_MINUTES
      cursor += TRIAL_MINUTES
      if (block.date === today && start < nowMinutes) continue
      const window = { tutor: block.tutor, date: block.date, start: start - BUFFER_MINUTES, end: end + BUFFER_MINUTES }
      const busy =
        taken.some((item) => item.tutor === block.tutor && item.date === block.date && overlaps(window.start, window.end, item)) ||
        slots.some(
          (item) =>
            item.tutor === block.tutor &&
            item.date === block.date &&
            overlaps(window.start, window.end, item),
        )
      if (busy) continue
      slots.push({
        tutor: block.tutor,
        date: block.date,
        startsAt: fromMinutes(start),
        endsAt: fromMinutes(end),
        start: window.start,
        end: window.end,
      })
    }
  }

  return slots
}
