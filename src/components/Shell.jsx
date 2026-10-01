export default function Shell({ title, subtitle, notice, onLogout, children }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-800 text-base font-semibold text-white">
            G
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Grafik</p>
            <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
            <p className="text-sm text-stone-500">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white"
        >
          Wyloguj
        </button>
      </header>
      {notice && (
        <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{notice}</p>
      )}
      <div className="flex-1">{children}</div>
      <p className="mt-10 text-center text-xs text-stone-400">Lekcje zapisują się w Supabase.</p>
    </div>
  )
}
