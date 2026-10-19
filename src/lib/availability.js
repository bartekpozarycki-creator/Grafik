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

export function emptyStatuses(names = []) {
  return Object.fromEntries(names.map((name) => [name, true]))
}

export async function fetchStatuses(names = []) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("tutor_status").select("tutor, taking, bookable")
  if (error) fail(error, "Nie udało się wczytać statusu korepetytorów.")
  const statuses = emptyStatuses(names)
  const closed = []
  for (const row of data ?? []) {
    statuses[row.tutor] = Boolean(row.taking)
    if (row.bookable === false) closed.push(row.tutor)
  }
  return { statuses, closed }
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

const DAY_MS = 24 * 60 * 60 * 1000

export function isExpiredFreeHour(slot, now = Date.now()) {
  const [year, month, day] = String(slot.date).split("-").map(Number)
  const [hour, minute] = String(slot.endsAt || "00:00").split(":").map(Number)
  const ended = new Date(year, month - 1, day, hour || 0, minute || 0).getTime()
  return ended < now - DAY_MS
}

async function dropExpiredFreeHours(slots) {
  const stale = slots.filter((slot) => isExpiredFreeHour(slot))
  if (!stale.length) return slots
  await Promise.all(stale.map((slot) => deleteFreeHour(slot.id, slot.tutor).catch(() => {})))
  const gone = new Set(stale.map((slot) => slot.id))
  return slots.filter((slot) => !gone.has(slot.id))
}

export async function fetchFreeHours() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const slots = await selectFreeHours((query) => query)
  const { data, error } = await supabase.from("lessons").select("tutor,date,starts_at,duration")
  if (error) fail(error, "Nie udało się wczytać lekcji.")
  const lessons = (data ?? []).map((row) => ({
    tutor: row.tutor,
    date: String(row.date).slice(0, 10),
    startsAt: row.starts_at ? String(row.starts_at).slice(0, 5) : "",
    duration: Number(row.duration),
  }))
  const personal = await supabase.from("personal_events").select("tutor,date,starts_at,ends_at")
  const own = personal.error
    ? []
    : (personal.data ?? []).map((row) => {
        const startsAt = row.starts_at ? String(row.starts_at).slice(0, 5) : ""
        const endsAt = row.ends_at ? String(row.ends_at).slice(0, 5) : ""
        const [startHour, startMinute] = startsAt.split(":").map(Number)
        const [endHour, endMinute] = endsAt.split(":").map(Number)
        return {
          tutor: row.tutor,
          date: String(row.date).slice(0, 10),
          startsAt,
          duration: endHour * 60 + endMinute - (startHour * 60 + startMinute),
        }
      })
  const changed = await commitFit(slots, fitFreeHours(slots, [...lessons, ...own.filter((event) => event.duration > 0)]))
  const fresh = changed ? await selectFreeHours((query) => query) : slots
  return dropExpiredFreeHours(fresh)
}

export async function addFreeHours(entries, lessons = []) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  if (entries.length === 0) return []
  const tutors = [...new Set(entries.map((entry) => entry.tutor))]
  const dates = [...new Set(entries.map((entry) => entry.date))]
  const existing = await selectFreeHours((query) => query.in("tutor", tutors).in("date", dates))
  await commitFit(existing, fitFreeHours([...existing, ...entries], lessons))
  return selectFreeHours((query) => query.in("tutor", tutors).in("date", dates))
}

export async function changeFreeHour(id, tutor, slot, lessons = []) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  await updateFreeHour(id, tutor, slot)
  const day = await selectFreeHours((query) => query.eq("tutor", tutor).eq("date", slot.date))
  await commitFit(day, fitFreeHours(day, lessons))
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

const MIN_FREE_MINUTES = 45
const MAX_BREAK_MINUTES = 30

function longEnough(range) {
  if (!range) return null
  if (toMinutes(range.endsAt) - toMinutes(range.startsAt) < MIN_FREE_MINUTES) return null
  return range
}

function lessonBlock(lesson) {
  if (!lesson.startsAt) return null
  const start = toMinutes(lesson.startsAt)
  const end = start + Number(lesson.duration)
  if (!(end > start)) return null
  return { tutor: lesson.tutor, date: lesson.date, start, end }
}

function activityBreak(blocks, start, end) {
  for (let index = 0; index < blocks.length - 1; index += 1) {
    const left = blocks[index]
    const right = blocks[index + 1]
    const gap = right.start - left.end
    if (gap < 0 || gap > MAX_BREAK_MINUTES) continue
    if (start >= left.end && end <= right.start) return true
  }
  return false
}

function abutPiece(piece, blocks) {
  if (activityBreak(blocks, piece.start, piece.end)) return piece
  let start = piece.start
  let end = piece.end
  let next = null
  let prev = null
  for (const block of blocks) {
    if (block.start >= end && (!next || block.start < next.start)) next = block
    if (block.end <= start && (!prev || block.end > prev.end)) prev = block
  }
  if (next && next.start - end > 0 && next.start - end <= MAX_BREAK_MINUTES) end = next.start
  if (prev && start - prev.end > 0 && start - prev.end <= MAX_BREAK_MINUTES) start = prev.end
  return { start, end }
}

function mergePieces(pieces) {
  const sorted = [...pieces].sort((left, right) => left.start - right.start || left.end - right.end)
  const merged = []
  for (const piece of sorted) {
    const last = merged.at(-1)
    if (last && piece.start <= last.end) last.end = Math.max(last.end, piece.end)
    else merged.push({ start: piece.start, end: piece.end })
  }
  return merged
}

function subtractPiece(pieces, blockStart, blockEnd) {
  const next = []
  for (const piece of pieces) {
    if (blockEnd <= piece.start || blockStart >= piece.end) {
      next.push(piece)
      continue
    }
    if (piece.start < blockStart) next.push({ start: piece.start, end: blockStart })
    if (piece.end > blockEnd) next.push({ start: blockEnd, end: piece.end })
  }
  return next
}

export function fitFreeHours(slots, lessons) {
  const groups = new Map()
  for (const slot of slots) {
    const key = `${slot.tutor}|${slot.date}`
    const list = groups.get(key)
    if (list) list.push(slot)
    else groups.set(key, [slot])
  }

  const desired = []
  for (const [key, list] of groups) {
    const splitAt = key.indexOf("|")
    const tutor = key.slice(0, splitAt)
    const date = key.slice(splitAt + 1)
    let pieces = mergePieces(
      list
        .map((slot) => ({ start: toMinutes(slot.startsAt), end: toMinutes(slot.endsAt) }))
        .filter((piece) => piece.end > piece.start),
    )
    const original = new Set(pieces.map((piece) => `${piece.start}-${piece.end}`))
    const blocks = []
    for (const lesson of lessons) {
      if (lesson.tutor !== tutor || lesson.date !== date) continue
      const block = lessonBlock(lesson)
      if (!block) continue
      blocks.push(block)
      pieces = subtractPiece(pieces, block.start, block.end)
    }
    blocks.sort((left, right) => left.start - right.start || left.end - right.end)
    pieces = mergePieces(pieces.map((piece) => abutPiece(piece, blocks)))
    for (const piece of pieces) {
      const same = original.has(`${piece.start}-${piece.end}`)
      if (!same && piece.end - piece.start < MIN_FREE_MINUTES) continue
      const range = openRange(piece.start, piece.end)
      if (range) desired.push({ tutor, date, ...range })
    }
  }
  return desired
}

async function commitFit(existing, desired) {
  const keys = new Set([...existing, ...desired].map((slot) => `${slot.tutor}|${slot.date}`))
  const updates = []
  const removeIds = []
  const inserts = []
  for (const key of keys) {
    const splitAt = key.indexOf("|")
    const tutor = key.slice(0, splitAt)
    const date = key.slice(splitAt + 1)
    const have = existing
      .filter((slot) => slot.tutor === tutor && slot.date === date)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt))
    const want = desired
      .filter((slot) => slot.tutor === tutor && slot.date === date)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt))
    const count = Math.min(have.length, want.length)
    for (let index = 0; index < count; index += 1) {
      if (have[index].startsAt !== want[index].startsAt || have[index].endsAt !== want[index].endsAt) {
        updates.push({
          id: have[index].id,
          tutor,
          date,
          startsAt: want[index].startsAt,
          endsAt: want[index].endsAt,
        })
      }
    }
    for (let index = count; index < have.length; index += 1) removeIds.push(have[index])
    for (let index = count; index < want.length; index += 1) inserts.push(want[index])
  }
  if (updates.length === 0 && removeIds.length === 0 && inserts.length === 0) return false
  for (const slot of updates) await updateFreeHour(slot.id, slot.tutor, slot)
  if (inserts.length) await createFreeHours(inserts)
  for (const slot of removeIds) await deleteFreeHour(slot.id, slot.tutor)
  return true
}

export function carveFreeHours(slots, lesson) {
  const block = lessonBlock(lesson)
  if (!block) return { removeIds: [], updates: [], inserts: [] }
  const blockStart = block.start
  const blockEnd = block.end
  const removeIds = []
  const updates = []
  const inserts = []

  for (const slot of slots) {
    if (slot.tutor !== lesson.tutor || slot.date !== lesson.date) continue
    const start = toMinutes(slot.startsAt)
    const end = toMinutes(slot.endsAt)
    if (blockEnd <= start || blockStart >= end) continue
    const left = longEnough(openRange(start, Math.min(end, blockStart)))
    const right = longEnough(openRange(Math.max(start, blockEnd), end))
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

function gapCoveredByFreeTime(slots, tutor, date, start, end) {
  if (end <= start) return false
  return slots.some((slot) => {
    if (slot.tutor !== tutor || slot.date !== date) return false
    const slotStart = toMinutes(slot.startsAt)
    const slotEnd = toMinutes(slot.endsAt)
    return slotStart < end && slotEnd > start
  })
}

export function freeBreaks(activities, slots = []) {
  const groups = new Map()
  for (const activity of activities) {
    if (!activity.startsAt || !activity.endsAt) continue
    const start = toMinutes(activity.startsAt)
    const end = toMinutes(activity.endsAt)
    if (end <= start) continue
    const key = `${activity.tutor}|${activity.date}`
    const item = { ...activity, start, end }
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }

  const pauses = []
  for (const list of groups.values()) {
    list.sort((left, right) => left.start - right.start || left.end - right.end)
    for (let index = 0; index < list.length - 1; index += 1) {
      const left = list[index]
      const right = list[index + 1]
      const gap = right.start - left.end
      if (gap < 0 || gap > MAX_BREAK_MINUTES) continue
      if (gapCoveredByFreeTime(slots, left.tutor, left.date, left.end, right.start)) continue
      const duration = right.end - right.start
      const after = list[index + 2]
      const room = after ? after.start - left.end - duration : 24 * 60 - left.end - duration
      pauses.push({
        id: `${left.id}-${right.id}`,
        tutor: left.tutor,
        date: left.date,
        startsAt: fromMinutes(left.end),
        endsAt: fromMinutes(right.start),
        minutes: gap,
        max: Math.max(gap, Math.min(MAX_BREAK_MINUTES, Math.max(0, room))),
        anchor: left.end,
        followerId: right.id,
        followerKind: right.followerKind,
      })
    }
  }
  return pauses
}

export function shiftForBreak(follower, pause, minutes) {
  const next = Math.max(0, Math.min(pause.max ?? MAX_BREAK_MINUTES, minutes))
  const duration = toMinutes(follower.endsAt) - toMinutes(follower.startsAt)
  return {
    startsAt: fromMinutes(pause.anchor + next),
    endsAt: fromMinutes(pause.anchor + next + duration),
  }
}

export async function deleteFreeHour(id, tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("free_hours").delete().eq("id", id).eq("tutor", tutor)
  if (error) fail(error, "Nie udało się usunąć wolnych godzin.")
}
