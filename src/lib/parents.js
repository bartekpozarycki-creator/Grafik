import { supabase } from "./supabase"

function fail(error, fallback) {
  if (error?.code === "PGRST205") {
    throw new Error("Dane rodziców nie są jeszcze gotowe w Supabase. Uruchom plik supabase/parents.sql.")
  }
  throw new Error(fallback)
}

function fromRow(row) {
  return {
    studentKey: row.student_key,
    info: row.info ?? "",
    active: row.active !== false,
  }
}

export function parentKey(discord, studentName) {
  const handle = String(discord ?? "").trim().toLowerCase()
  return handle || String(studentName ?? "").trim().toLowerCase()
}

export async function fetchParents() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("student_parents").select("*")
  if (error) fail(error, "Nie udało się wczytać danych rodziców.")
  const parents = {}
  const active = {}
  for (const row of data ?? []) {
    const item = fromRow(row)
    parents[item.studentKey] = item.info
    if (!item.active) active[item.studentKey] = false
  }
  return { parents, active }
}

export async function saveStudentActive(studentKey, active) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const row = {
    student_key: studentKey,
    active: Boolean(active),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from("student_parents").upsert(row).select("*").single()
  if (error?.code === "PGRST204" || error?.code === "42703") {
    throw new Error("Status ucznia nie jest jeszcze gotowy w Supabase. Uruchom plik supabase/student_status.sql.")
  }
  if (error) fail(error, "Nie udało się zapisać statusu ucznia.")
  return fromRow(data).active
}

export async function deleteParent(studentKey) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("student_parents").delete().eq("student_key", studentKey)
  if (error) fail(error, "Nie udało się przenieść danych rodzica.")
}

export async function saveParent(studentKey, info) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const text = String(info ?? "").trim()
  if (text.length > 2000) throw new Error("Dane rodzica mogą mieć najwyżej 2000 znaków.")
  const row = {
    student_key: studentKey,
    info: text,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from("student_parents").upsert(row).select("*").single()
  if (error) fail(error, "Nie udało się zapisać danych rodzica.")
  return fromRow(data).info
}
