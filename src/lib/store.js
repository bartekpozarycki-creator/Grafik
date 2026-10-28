const LESSONS_KEY = "grafik.lessons.v1"
const SESSION_KEY = "grafik.session.v1"

export const DEFAULT_PRICES = {
  rozszerzenie: 100,
  podstawa: 90,
  podstawowka: 90,
  studia: 100,
}

export const DURATIONS = [45, 60, 90]

const SHORT_LESSON_MINUTES = 45
const LONG_LESSON_MINUTES = 90

const SHORT_LESSON_PRICES = {
  podstawa: 70,
  podstawowka: 70,
  rozszerzenie: 80,
}

const LONG_LESSON_PRICES = {
  podstawa: 130,
  podstawowka: 130,
  rozszerzenie: 140,
}

export const KINDS = [
  { id: "zwykla", label: "Zwykła" },
  { id: "probna", label: "Próbna" },
]

export const LEVELS = [
  { id: "rozszerzenie", label: "Rozszerzenie" },
  { id: "podstawa", label: "Podstawa" },
  { id: "podstawowka", label: "Podstawówka" },
]

export const PRICE_LEVELS = [
  { id: "rozszerzenie", label: "Poziom rozszerzony", levels: ["rozszerzenie"] },
  { id: "podstawa", label: "Podstawa", levels: ["podstawa", "podstawowka"] },
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

const tutorsByName = new Map()
const pricesByLevel = new Map(Object.entries(DEFAULT_PRICES))

export function rememberPrices(prices) {
  pricesByLevel.clear()
  for (const [level, price] of Object.entries({ ...DEFAULT_PRICES, ...(prices ?? {}) })) {
    const value = Number(price)
    if (Number.isFinite(value)) pricesByLevel.set(level, Math.max(0, value))
  }
}

export function currentPrices() {
  return Object.fromEntries(pricesByLevel)
}

function hoursOf(lesson) {
  return Number(lesson.duration || 0) / 60
}

export function lessonPriceFor(level, duration, prices = currentPrices()) {
  const minutes = Number(duration)
  if (minutes === SHORT_LESSON_MINUTES && level in SHORT_LESSON_PRICES) return SHORT_LESSON_PRICES[level]
  if (minutes === LONG_LESSON_MINUTES && level in LONG_LESSON_PRICES) return LONG_LESSON_PRICES[level]
  return (Number(prices?.[level]) || 0) * (minutes / 60)
}

export function paySplit(prices, profit, level, duration) {
  const price = lessonPriceFor(level, duration, prices)
  const school = Math.min(price, Math.max(0, (Number(profit) || 0) * (Number(duration) / 60)))
  const roundedSchool = Math.round(school * 100) / 100
  return {
    price,
    tutor: Math.round((price - roundedSchool) * 100) / 100,
    school: roundedSchool,
  }
}

function lessonPrice(lesson) {
  return lessonPriceFor(lesson.level, lesson.duration)
}

function roundMoney(value) {
  const amount = Math.round((Number(value) || 0) * 100) / 100
  if (amount > 0 && Math.round(amount * 100) % 1000 === 500) return amount - 5
  return amount
}

export function rememberTutors(tutors) {
  tutorsByName.clear()
  for (const tutor of tutors ?? []) {
    if (tutor?.name) tutorsByName.set(tutor.name, tutor)
  }
}

export function countsMoney(name) {
  const tutor = tutorsByName.get(name)
  if (!tutor) return true
  return tutor.countsMoney !== false
}

function validTutor(item) {
  return item && typeof item.name === "string" && typeof item.countsMoney === "boolean"
}

function readSession(storage) {
  try {
    return JSON.parse(storage.getItem(SESSION_KEY) || "null")
  } catch {
    return null
  }
}

export function loadSession() {
  const parsed = readSession(localStorage) ?? readSession(sessionStorage)
  if (parsed?.role === "admin" && Array.isArray(parsed.tutors) && parsed.tutors.every(validTutor)) return parsed
  if (parsed?.role === "tutor" && validTutor(parsed)) return parsed
  return null
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

export function keepSession(session) {
  saveSession(session, localStorage.getItem(SESSION_KEY) != null)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

export function loadLessons() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LESSONS_KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter((lesson) => lesson && typeof lesson.tutor === "string" && typeof lesson.date === "string")
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

export function attendedRegular(lesson) {
  return lesson.kind === "zwykla" && lesson.held === true
}

export function countsAsStudent(lessons) {
  return lessons.some(attendedRegular)
}

function countsTowardMoney(lesson) {
  return lesson.kind !== "probna" && countsMoney(lesson.tutor) && lesson.held === true
}

function configuredTutor(lesson) {
  const cell = tutorsByName.get(lesson.tutor)?.pay?.[lesson.level]?.[String(lesson.duration)]
  if (!cell || typeof cell !== "object") return null
  const tutor = Number(cell.tutor)
  if (!Number.isFinite(tutor) || tutor < 0) return null
  return tutor
}

function tutorShare(lesson) {
  const price = lessonPrice(lesson)
  const set = configuredTutor(lesson)
  if (set != null) return Math.min(price, set)
  const cut = (tutorsByName.get(lesson.tutor)?.profit ?? 0) * hoursOf(lesson)
  return Math.max(0, price - cut)
}

function schoolShare(lesson) {
  return Math.max(0, lessonPrice(lesson) - tutorShare(lesson))
}

export function lessonRevenue(lesson) {
  if (!countsTowardMoney(lesson) || !lesson.studentPaid) return 0
  return roundMoney(lessonPrice(lesson))
}

export function tutorEarning(lesson) {
  if (!countsTowardMoney(lesson) || !lesson.tutorPaid) return 0
  return tutorShare(lesson)
}

export function lessonProfit(lesson) {
  if (!countsTowardMoney(lesson) || !lesson.studentPaid) return 0
  return schoolShare(lesson)
}

export function trialPayout(lesson, stayed) {
  if (lesson.kind !== "probna" || lesson.held !== true || !countsMoney(lesson.tutor)) return 0
  const hourly = tutorShare({ ...lesson, duration: 60 })
  return Math.round(hourly * (stayed ? 1 : 0.5) * 100) / 100
}

export function formatMoney(amount) {
  const value = Math.round((Number(amount) || 0) * 100) / 100
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value)} zł`
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
  return options.find((option) => option.id === id)?.label ?? (id === "studia" ? "Studia" : String(id ?? ""))
}
