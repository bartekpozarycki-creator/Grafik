import { supabase } from "./supabase"

export async function saveTutorRates(rates) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const rows = Object.entries(rates).map(([name, pay]) => ({ name, pay }))
  const { error } = await supabase.rpc("save_tutor_rates", { rates: rows })
  if (error?.code === "PGRST202" || error?.code === "42883") {
    throw new Error("Stawki nie są jeszcze gotowe w Supabase. Uruchom plik supabase/tutor_rates.sql.")
  }
  if (error) throw new Error("Nie udało się zapisać stawek.")
}
