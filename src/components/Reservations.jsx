import { formatDay } from "../lib/store"

export default function Reservations({ bookings, tutor, notice }) {
  const rows = bookings
    .filter((item) => !tutor || item.tutor === tutor)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.startsAt.localeCompare(right.startsAt))

  return (
    <section className="mb-4 rounded-3xl border border-stone-200 bg-stone-100 p-4 text-stone-400 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Rezerwacje próbnych</h2>
        <span className="text-xs font-medium">Na razie niedostępne</span>
      </div>
      {notice && <p className="mt-2 text-sm">{notice}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm">Brak rezerwacji.</p>
      ) : (
        <ul className="pointer-events-none mt-3 flex flex-col gap-2">
          {rows.map((item) => (
            <li key={item.id} className="rounded-2xl bg-stone-50 px-3 py-3 text-sm">
              <p className="font-medium">
                {formatDay(item.date)} · {item.startsAt} · {item.tutor}
              </p>
              <p className="mt-1">
                {item.studentName} · {item.discord}
              </p>
              <p className="mt-1">
                {item.email} · {item.phone}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
