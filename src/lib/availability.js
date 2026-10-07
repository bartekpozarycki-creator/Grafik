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

async function selectFreeHours(filter) {
  let query = supabase.from("free_hours").select("*").order("date", { ascending: true }).order("starts_at", { ascending: true })
  query = filter(query)
  const { data, error } = await query
  if (error) fail(error, "Nie udało się wczytać wolnych godzin.")
  return (data ?? []).map(fromHour)
}

async function persistFreeHourMerge(slots) {
  const plan = planFreeHourMerge(slots)
  if (plan.updates.length === 0 && plan.removeIds.length === 0 && plan.inserts.length === 0) return false
  for (const slot of plan.updates) await updateFreeHour(slot.id, slot.tutor, slot)
  if (plan.inserts.length) await createFreeHours(plan.inserts)
  for (const slot of plan.removeIds) await deleteFreeHour(slot.id, slot.tutor)
  return true
}

export async function fetchFreeHours() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const slots = await selectFreeHours((query) => query)
  const changed = await persistFreeHourMerge(slots)
  if (!changed) return slots
  return selectFreeHours((query) => query)
}

export async function addFreeHours(entries) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  if (entries.length === 0) return []
  const tutors = [...new Set(entries.map((entry) => entry.tutor))]
  const dates = [...new Set(entries.map((entry) => entry.date))]
  const existing = await selectFreeHours((query) => query.in("tutor", tutors).in("date", dates))
  await persistFreeHourMerge([...existing, ...entries])
  return selectFreeHours((query) => query.in("tutor", tutors).in("date", dates))
}

export async function changeFreeHour(id, tutor, slot) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  await updateFreeHour(id, tutor, slot)
  const day = await selectFreeHours((query) => query.eq("tutor", tutor).eq("date", slot.date))
  await persistFreeHourMerge(day)
  return selectFreeHours((query) => query.eq("tutor", tutor).eq("date", slot.date))
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

function toMinutes(value) {
  const [hour, minute] = String(value).slice(0, 5).split(":").map(Number)
  return hour * 60 + minute
}

function fromMinutes(total) {
  const clamped = Math.max(0, Math.min(24 * 60, total))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function openRange(start, end) {
  if (end <= start) return null
  return { startsAt: fromMinutes(start), endsAt: fromMinutes(end) }
}

function planFreeHourMerge(slots) {
  const groups = new Map()
  for (const slot of slots) {
    const key = `${slot.tutor}|${slot.date}`
    const list = groups.get(key)
    if (list) list.push(slot)
    else groups.set(key, [slot])
  }

  const updates = []
  const removeIds = []
  const inserts = []

  for (const list of groups.values()) {
    const sorted = [...list].sort(
      (a, b) => toMinutes(a.startsAt) - toMinutes(b.startsAt) || toMinutes(a.endsAt) - toMinutes(b.endsAt),
    )
    const blocks = []
    for (const slot of sorted) {
      const start = toMinutes(slot.startsAt)
      const end = toMinutes(slot.endsAt)
      if (!(end > start)) continue
      const last = blocks.at(-1)
      if (last && start <= last.end) {
        last.end = Math.max(last.end, end)
        last.sources.push(slot)
      } else {
        blocks.push({ start, end, tutor: slot.tutor, date: slot.date, sources: [slot] })
      }
    }

    for (const block of blocks) {
      const range = openRange(block.start, block.end)
      if (!range) continue
      const keeper = block.sources.find((slot) => slot.id)
      if (keeper) {
        if (keeper.startsAt !== range.startsAt || keeper.endsAt !== range.endsAt) {
          updates.push({ id: keeper.id, tutor: block.tutor, date: block.date, ...range })
        }
        for (const slot of block.sources) {
          if (slot.id && slot.id !== keeper.id) removeIds.push({ id: slot.id, tutor: slot.tutor })
        }
      } else {
        inserts.push({ tutor: block.tutor, date: block.date, ...range })
      }
    }
  }

  return { updates, removeIds, inserts }
}

export function carveFreeHours(slots, lesson) {
  const blockStart = toMinutes(lesson.startsAt) - 15
  const blockEnd = toMinutes(lesson.startsAt) + Number(lesson.duration) + 15
  const removeIds = []
  const updates = []
  const inserts = []

  for (const slot of slots) {
    if (slot.tutor !== lesson.tutor || slot.date !== lesson.date) continue
    const start = toMinutes(slot.startsAt)
    const end = toMinutes(slot.endsAt)
    if (blockEnd <= start || blockStart >= end) continue
    const left = openRange(start, Math.min(end, blockStart))
    const right = openRange(Math.max(start, blockEnd), end)
    if (left && right) {
      updates.push({ id: slot.id, tutor: slot.tutor, date: slot.date, ...left })
      inserts.push({ tutor: slot.tutor, date: slot.date, ...right })
    } else if (left) {
      updates.push({ id: slot.id, tutor: slot.tutor, date: slot.date, ...left })
    } else if (right) {
      updates.push({ id: slot.id, tutor: slot.tutor, date: slot.date, ...right })
    } else {
      removeIds.push(slot.id)
    }
  }

  return { removeIds, updates, inserts }
}

export async function deleteFreeHour(id, tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("free_hours").delete().eq("id", id).eq("tutor", tutor)
  if (error) fail(error, "Nie udało się usunąć wolnych godzin.")
}
