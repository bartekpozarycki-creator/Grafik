const LESSONS_KEY = "grafik.lessons.v1"
const SESSION_KEY = "grafik.session.v1"

export const TUTORS = ["Tomek", "Wojtek", "Szymon", "Test"]
export const TEST_TUTOR = "Test"
export const ADMIN_LOGIN = "AdminLogin"

export const LEVEL_PRICE = {
  rozszerzenie: 100,
  podstawa: 90,
  podstawowka: 90,
}

export const TUTOR_PROFIT = {
  Tomek: 30,
  Wojtek: 20,
  Szymon: 30,
}

export const DURATIONS = [45, 60, 90]

export const KINDS = [
  { id: "zwykla", label: "Zwykła" },
  { id: "probna", label: "Próbna" },
]

export const LEVELS = [
  { id: "podstawa", label: "Podstawa" },
  { id: "podstawowka", label: "Podstawówka" },
  { id: "rozszerzenie", label: "Rozszerzenie" },
]

export const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]

const MONTHS = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
]

export function matchLogin(raw) {
  const value = String(raw ?? "").trim().toLowerCase()
  if (!value) return null
  if (value === ADMIN_LOGIN.toLowerCase()) {
    return { role: "admin", name: ADMIN_LOGIN }
  }
  const tutor = TUTORS.find((name) => name.toLowerCase() === value)
  if (tutor) return { role: "tutor", name: tutor }
  return null
}

function readSession(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(SESSION_KEY) || "null")
    if (parsed?.role === "admin" && parsed?.name === ADMIN_LOGIN) return parsed
    if (parsed?.role === "tutor" && TUTORS.includes(parsed?.name)) return parsed
    return null
  } catch {
    return null
  }
}

export function loadSession() {
  return readSession(localStorage) ?? readSession(sessionStorage)
}

export function saveSession(session, remember) {
  const raw = JSON.stringify(session)
  if (remember) {
    localStorage.setItem(SESSION_KEY, raw)
    sessionStorage.removeItem(SESSION_KEY)
    return
  }
  sessionStorage.setItem(SESSION_KEY, raw)
  localStorage.removeItem(SESSION_KEY)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

export function loadLessons() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LESSONS_KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (lesson) => lesson && TUTORS.includes(lesson.tutor) && typeof lesson.date === "string",
    )
  } catch {
    return []
  }
}

export function saveLessons(lessons) {
  try {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(lessons))
  } catch {
    return
  }
}

export function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function todayKey() {
  const now = new Date()
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(key, days) {
  const [year, month, day] = String(key).split("-").map(Number)
  const date = new Date(year, month - 1, day + days)
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate())
}

export function weeklyDates(start, until) {
  const dates = []
  let cursor = start
  while (cursor <= until && dates.length < 40) {
    dates.push(cursor)
    cursor = addDays(cursor, 7)
  }
  return dates
}

export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

export function dateInMonth(key, year, month) {
  const [lessonYear, lessonMonth] = String(key).split("-").map(Number)
  return lessonYear === year && lessonMonth === month + 1
}

export function buildMonthCells(year, month) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const count = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let index = 0; index < lead; index += 1) cells.push(null)
  for (let day = 1; day <= count; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function lessonRevenue(lesson) {
  if (lesson.tutor === TEST_TUTOR || lesson.held !== true) return 0
  return LEVEL_PRICE[lesson.level] ?? 0
}

export function lessonProfit(lesson) {
  if (lesson.tutor === TEST_TUTOR || lesson.held !== true) return 0
  return TUTOR_PROFIT[lesson.tutor] ?? 0
}

export function formatMoney(amount) {
  return `${new Intl.NumberFormat("pl-PL").format(amount)} zł`
}

export function monthTitle(year, month) {
  const name = MONTHS[month]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

export function formatDay(key) {
  const [year, month, day] = key.split("-").map(Number)
  const formatted = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function formatShort(key) {
  const [year, month, day] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day))
}

export function formatMinutes(total) {
  const safe = Number(total) || 0
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

export function lessonsLabel(count) {
  const amount = Math.abs(Number(count) || 0)
  if (amount === 1) return "lekcja"
  const mod10 = amount % 10
  const mod100 = amount % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "lekcje"
  return "lekcji"
}

export function labelOf(options, id) {
  return options.find((option) => option.id === id)?.label ?? String(id ?? "")
}
