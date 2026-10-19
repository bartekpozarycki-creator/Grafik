import { supabase } from "./supabase"

function fail(error, fallback) {
  if (error?.code === "PGRST205") {
    throw new Error("Tabela ważnych linków nie jest jeszcze gotowa w Supabase. Uruchom plik supabase/important_links.sql.")
  }
  throw new Error(fallback)
}

function fromRow(row) {
  return {
    id: row.id,
    tutor: row.tutor,
    title: row.title,
    url: row.url,
    createdAt: row.created_at ? Date.parse(row.created_at) : 0,
  }
}

export async function fetchImportantLinks() {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("important_links")
    .select("id,tutor,title,url,created_at")
    .order("created_at", { ascending: true })
  if (error) fail(error, "Nie udało się wczytać ważnych linków.")
  return (data ?? []).map(fromRow)
}

export async function createImportantLink(link) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { data, error } = await supabase
    .from("important_links")
    .insert({ tutor: link.tutor, title: link.title, url: link.url })
    .select("id,tutor,title,url,created_at")
    .single()
  if (error) fail(error, "Nie udało się dodać linku.")
  return fromRow(data)
}

export async function deleteImportantLink(id, tutor) {
  if (!supabase) throw new Error("Brak konfiguracji Supabase.")
  const { error } = await supabase.from("important_links").delete().eq("id", id).eq("tutor", tutor)
  if (error) fail(error, "Nie udało się usunąć linku.")
}
