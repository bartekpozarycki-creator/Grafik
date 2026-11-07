import { DEFAULT_PRICES, defaultPrices, priceKey } from "./store"
import { supabase } from "./supabase"

const PRICE_COLUMNS = "level, price, price_45, price_90"

function fromRows(rows) {
  const prices = defaultPrices()
  for (const row of rows ?? []) {
    if (!(row?.level in DEFAULT_PRICES)) continue
    prices[row.level] = Number(row.price)
    if (row.price_45 != null) prices[priceKey(row.level, 45)] = Number(row.price_45)
    if (row.price_90 != null) prices[priceKey(row.level, 90)] = Number(row.price_90)
  }
  return prices
}

async function readPrices() {
  let result = await supabase.from("level_prices").select(PRICE_COLUMNS)
  if (result.error?.code === "42703" || result.error?.code === "PGRST204") {
    result = await supabase.from("level_prices").select("level, price")
  }
  return result
}

export async function fetchPrices() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await readPrices()
  if (error?.code === "PGRST205") {
    throw new Error("Ceny poziomów nie są jeszcze gotowe w Supabase. Uruchom plik supabase/prices.sql.")
  }
  if (error) throw new Error("Nie udało się wczytać cen zajęć.")
  return fromRows(data)
}

export async function savePrices(prices) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const rows = Object.keys(DEFAULT_PRICES)
    .filter((level) => Number.isFinite(Number(prices[level])))
    .map((level) => {
      const row = { level, price: Number(prices[level]) }
      const short = Number(prices[priceKey(level, 45)])
      const long = Number(prices[priceKey(level, 90)])
      if (Number.isFinite(short)) row.price_45 = short
      if (Number.isFinite(long)) row.price_90 = long
      return row
    })
  let result = await supabase.from("level_prices").upsert(rows).select(PRICE_COLUMNS)
  if (result.error?.code === "42703" || result.error?.code === "PGRST204") {
    throw new Error("Ceny 45 i 90 min nie są jeszcze gotowe w Supabase. Uruchom plik supabase/lesson_prices.sql.")
  }
  if (result.error?.code === "PGRST205") {
    throw new Error("Ceny poziomów nie są jeszcze gotowe w Supabase. Uruchom plik supabase/prices.sql.")
  }
  if (result.error) throw new Error("Nie udało się zapisać cen zajęć.")
  return fromRows(result.data)
}
