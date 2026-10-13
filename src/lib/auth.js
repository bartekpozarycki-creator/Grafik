import { supabase } from "./supabase"

export async function lookupLogin(raw) {
  const value = String(raw ?? "").trim()
  if (!value) return null
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.rpc("match_login", { raw: value })
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("Logowanie nie jest gotowe w Supabase. Uruchom plik supabase/logins.sql.")
    }
    throw new Error("Nie udało się sprawdzić loginu.")
  }
  return data
}

export async function reserveAllowed(raw, code) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase.rpc("reserve_allowed", {
    raw: String(raw ?? ""),
    given: String(code ?? ""),
  })
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("Rezerwacja nie jest gotowa w Supabase. Uruchom plik supabase/logins.sql.")
    }
    throw new Error("Nie udało się sprawdzić kodu.")
  }
  return data === true
}
