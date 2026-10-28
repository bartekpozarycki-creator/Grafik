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
  return Object.fromEntries((data ?? []).map((row) => [row.student_key, fromRow(row).info]))
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
