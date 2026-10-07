import { loadLessons } from "./store"
import { supabase } from "./supabase"

const LESSONS_KEY = "grafik.lessons.v1"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
let startsAtReady = null

function withoutStart(row) {
  const rest = { ...row }
  delete rest.starts_at
  return rest
}

function payloadFor(row) {
  return startsAtReady === false && "starts_at" in row ? withoutStart(row) : row
}

function fail(error, fallback) {
  if (error?.code === "PGRST205") {
    throw new Error("Tabela lekcji nie jest jeszcze gotowa w Supabase.")
  }
  throw new Error(fallback)
}

function fromRow(row) {
  return {
    id: row.id,
    tutor: row.tutor,
    date: String(row.date).slice(0, 10),
    studentName: row.student_name,
    discord: row.discord,
    duration: Number(row.duration),
    kind: row.kind,
    level: row.level,
    startsAt: row.starts_at ? String(row.starts_at).slice(0, 5) : "",
    held: "held" in row ? (row.held === true ? true : row.held === false ? false : null) : true,
    studentPaid: row.kind === "probna" ? true : Boolean(row.student_paid),
    tutorPaid: Boolean(row.tutor_paid),
    createdAt: row.created_at ? Date.parse(row.created_at) : 0,
  }
}

function toRow(lesson, includeId) {
  const row = {
    tutor: lesson.tutor,
    date: lesson.date,
    student_name: lesson.studentName,
    discord: lesson.discord,
    duration: Number(lesson.duration),
    kind: lesson.kind,
    level: lesson.level,
  }
  if (lesson.startsAt) row.starts_at = String(lesson.startsAt).length === 5 ? `${lesson.startsAt}:00` : lesson.startsAt
  if (includeId && UUID.test(String(lesson.id ?? ""))) row.id = lesson.id
  if (lesson.createdAt) row.created_at = new Date(lesson.createdAt).toISOString()
  return row
}

async function uploadLocal(remote) {
  const local = loadLessons()
  if (local.length === 0) return remote
  const known = new Set(remote.map((lesson) => lesson.id))
  const pending = local.filter((lesson) => !known.has(lesson.id))
  if (pending.length === 0) {
    localStorage.removeItem(LESSONS_KEY)
    return remote
  }
  const inserted = await supabase.from("lessons").insert(pending.map((lesson) => toRow(lesson, true))).select("*")
  if (inserted.error) return remote
  localStorage.removeItem(LESSONS_KEY)
  return [...remote, ...inserted.data.map(fromRow)]
}

export async function fetchLessons() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("lessons").select("*").order("created_at", { ascending: true })
  if (error) fail(error, "Nie udało się wczytać lekcji.")
  if (data?.length) startsAtReady = "starts_at" in data[0]
  return uploadLocal((data ?? []).map(fromRow))
}

async function writeLesson(query, row) {
  let result = await query(payloadFor(row))
  if (result.error?.code === "PGRST204" && "starts_at" in row) {
    startsAtReady = false
    result = await query(withoutStart(row))
  } else if (!result.error && "starts_at" in payloadFor(row)) {
    startsAtReady = true
  }
  return result
}

export async function createLesson(lesson) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const row = toRow(lesson, false)
  if (lesson.kind === "probna") row.student_paid = true
  const { data, error } = await writeLesson(
    (payload) => supabase.from("lessons").insert(payload).select("*").single(),
    row,
  )
  if (error) fail(error, "Nie udało się dodać lekcji.")
  return fromRow(data)
}

export async function updateLesson(id, tutor, lesson) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const row = toRow({ ...lesson, tutor }, false)
  if (lesson.kind === "probna") row.student_paid = true
  const { data, error } = await writeLesson(
    (payload) => supabase.from("lessons").update(payload).eq("id", id).eq("tutor", tutor).select("*").single(),
    row,
  )
  if (error) fail(error, "Nie udało się zapisać zmian.")
  return fromRow(data)
}

export async function setLessonHeld(id, held) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("lessons").update({ held }).eq("id", id).select("*").single()
  if (error?.code === "PGRST204" || error?.code === "42703") {
    throw new Error("Brakuje oznaczenia odbycia lekcji w Supabase. Uruchom plik supabase/lesson_held.sql.")
  }
  if (error) fail(error, "Nie udało się zapisać, czy zajęcia się odbyły.")
  return fromRow(data)
}

export async function setLessonPaid(id, patch) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const row = {}
  if ("studentPaid" in patch) row.student_paid = patch.studentPaid
  if ("tutorPaid" in patch) row.tutor_paid = patch.tutorPaid
  const { data, error } = await supabase.from("lessons").update(row).eq("id", id).select("*").single()
  if (error?.code === "PGRST204" || error?.code === "42703") {
    throw new Error("Brakuje statusu płatności w Supabase. Uruchom plik supabase/payments.sql.")
  }
  if (error) fail(error, "Nie udało się zapisać płatności.")
  return fromRow(data)
}

export async function deleteLesson(id, tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("lessons").delete().eq("id", id).eq("tutor", tutor)
  if (error) fail(error, "Nie udało się usunąć lekcji.")
}
