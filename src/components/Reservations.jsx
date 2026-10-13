import { formatDay } from "../lib/store"

export default function Reservations({ bookings, tutor, notice }) {
  const rows = bookings
    .filter((item) => !tutor || item.tutor === tutor)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.startsAt.localeCompare(right.startsAt))

  return (
    <section className="mb-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-stone-900">Rezerwacje próbnych</h2>
      {notice && <p className="mt-2 text-sm text-red-700">{notice}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Brak rezerwacji.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((item) => (
            <li key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-800">
              <p className="font-medium text-stone-900">
                {formatDay(item.date)} · {item.startsAt} · {item.tutor}
              </p>
              <p className="mt-1">
                {item.studentName} · {item.discord}
              </p>
              <p className="mt-1 text-stone-600">
                {item.email} · {item.phone}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
