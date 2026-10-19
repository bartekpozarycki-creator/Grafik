import { supabase } from "./supabase"

function fail(error, fallback) {
  if (error?.code === "PGRST205") {
    throw new Error("Własne zajęcia nie są jeszcze gotowe w Supabase. Uruchom plik supabase/personal_events.sql.")
  }
  throw new Error(fallback)
}

function fromRow(row) {
  return {
    id: row.id,
    tutor: row.tutor,
    date: String(row.date).slice(0, 10),
    title: row.title,
    startsAt: row.starts_at ? String(row.starts_at).slice(0, 5) : "",
    endsAt: row.ends_at ? String(row.ends_at).slice(0, 5) : "",
    createdAt: row.created_at ? Date.parse(row.created_at) : 0,
  }
}

function toRow(event) {
  return {
    tutor: event.tutor,
    date: event.date,
    title: event.title.trim(),
    starts_at: event.startsAt.length === 5 ? `${event.startsAt}:00` : event.startsAt,
    ends_at: event.endsAt.length === 5 ? `${event.endsAt}:00` : event.endsAt,
  }
}

export function personalSpan(event) {
  if (!event.startsAt || !event.endsAt) return 0
  const [startHour, startMinute] = event.startsAt.slice(0, 5).split(":").map(Number)
  const [endHour, endMinute] = event.endsAt.slice(0, 5).split(":").map(Number)
  return endHour * 60 + endMinute - (startHour * 60 + startMinute)
}

export async function fetchPersonalEvents(tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("personal_events")
    .select("*")
    .eq("tutor", tutor)
    .order("date", { ascending: true })
  if (error) fail(error, "Nie udało się wczytać własnych zajęć.")
  return (data ?? []).map(fromRow)
}

export async function createPersonalEvent(event) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("personal_events").insert(toRow(event)).select("*").single()
  if (error) fail(error, "Nie udało się dodać własnych zajęć.")
  return fromRow(data)
}

export async function updatePersonalEvent(id, tutor, event) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("personal_events")
    .update(toRow({ ...event, tutor }))
    .eq("id", id)
    .eq("tutor", tutor)
    .select("*")
    .single()
  if (error) fail(error, "Nie udało się zapisać własnych zajęć.")
  return fromRow(data)
}

export async function deletePersonalEvent(id, tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("personal_events").delete().eq("id", id).eq("tutor", tutor)
  if (error) fail(error, "Nie udało się usunąć własnych zajęć.")
}
