import { DEFAULT_PRICES } from "./store"
import { supabase } from "./supabase"

function fromRows(rows) {
  const prices = { ...DEFAULT_PRICES }
  for (const row of rows ?? []) {
    if (row?.level in prices) prices[row.level] = Number(row.price)
  }
  return prices
}

export async function fetchPrices() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.from("level_prices").select("level, price")
  if (error?.code === "PGRST205") {
    throw new Error("Ceny poziomów nie są jeszcze gotowe w Supabase. Uruchom plik supabase/prices.sql.")
  }
  if (error) throw new Error("Nie udało się wczytać cen zajęć.")
  return fromRows(data)
}

export async function savePrices(prices) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const rows = Object.keys(DEFAULT_PRICES).map((level) => ({
    level,
    price: Number(prices[level]),
  }))
  const { data, error } = await supabase.from("level_prices").upsert(rows).select("level, price")
  if (error?.code === "PGRST205") {
    throw new Error("Ceny poziomów nie są jeszcze gotowe w Supabase. Uruchom plik supabase/prices.sql.")
  }
  if (error) throw new Error("Nie udało się zapisać cen zajęć.")
  return fromRows(data)
}
