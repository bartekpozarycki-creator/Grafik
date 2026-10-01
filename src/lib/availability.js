import { TUTORS } from "./store"
import { supabase } from "./supabase"

function fail(error, fallback) {
  if (error?.code === "PGRST205") {
    throw new Error("Tabela wolnych godzin nie jest jeszcze gotowa w Supabase.")
  }
  throw new Error(fallback)
}

function clock(value) {
  const text = String(value ?? "")
  return text.length === 5 ? `${text}:00` : text
}

function fromHour(row) {
  return {
    id: row.id,
    tutor: row.tutor,
    date: String(row.date).slice(0, 10),
    startsAt: String(row.starts_at).slice(0, 5),
    endsAt: String(row.ends_at).slice(0, 5),
    createdAt: row.created_at ? Date.parse(row.created_at) : 0,
  }
}

export function emptyStatuses() {
  return Object.fromEntries(TUTORS.map((name) => [name, true]))
}

export async function fetchStatuses() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("tutor_status").select("tutor, taking")
  if (error) fail(error, "Nie udało się wczytać statusu korepetytorów.")
  const statuses = emptyStatuses()
  for (const row of data ?? []) statuses[row.tutor] = Boolean(row.taking)
  return statuses
}

export async function saveTutorStatus(tutor, taking) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("tutor_status").upsert(
    { tutor, taking, updated_at: new Date().toISOString() },
    { onConflict: "tutor" },
  )
  if (error) fail(error, "Nie udało się zapisać statusu.")
}

export async function fetchFreeHours() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("free_hours")
    .select("*")
    .order("date", { ascending: true })
    .order("starts_at", { ascending: true })
  if (error) fail(error, "Nie udało się wczytać wolnych godzin.")
  return (data ?? []).map(fromHour)
}

function toHour(slot) {
  return {
    tutor: slot.tutor,
    date: slot.date,
    starts_at: clock(slot.startsAt),
    ends_at: clock(slot.endsAt),
  }
}

export async function createFreeHours(slots) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("free_hours").insert(slots.map(toHour)).select("*")
  if (error) fail(error, "Nie udało się dodać wolnych godzin.")
  return (data ?? []).map(fromHour)
}

export async function updateFreeHour(id, tutor, slot) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("free_hours")
    .update({
      date: slot.date,
      starts_at: clock(slot.startsAt),
      ends_at: clock(slot.endsAt),
    })
    .eq("id", id)
    .eq("tutor", tutor)
    .select("*")
    .single()
  if (error?.code === "42501" || error?.code === "PGRST301" || error?.code === "PGRST116") {
    throw new Error("Brakuje uprawnienia do edycji wolnych godzin. Uruchom plik supabase/free_hours_edit.sql.")
  }
  if (error) fail(error, "Nie udało się zapisać wolnych godzin.")
  return fromHour(data)
}

export async function deleteFreeHour(id, tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("free_hours").delete().eq("id", id).eq("tutor", tutor)
  if (error) fail(error, "Nie udało się usunąć wolnych godzin.")
}
