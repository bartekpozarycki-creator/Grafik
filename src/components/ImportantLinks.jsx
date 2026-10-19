import { motion } from "framer-motion"

const LINKS = [
  {
    title: "matematykaszkolna.pl",
    href: "https://matematykaszkolna.pl/",
    note: "kod aktywacyjny: ah29jm48",
  },
  {
    title: "demo naszej strony z zadaniami",
    href: "https://donaukimatmy.netlify.app",
  },
  {
    title: "skany podręczników",
    href: "https://drive.google.com/drive/folders/1g2gs5Hau3Hgf_jArozJ0neGTixcqQpgE?usp=sharing",
    note: "to, co się na razie udało znaleźć",
  },
]

export default function ImportantLinks() {
  return (
    <section className="mb-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-stone-900">Ważne linki</h2>
      <p className="mt-1 text-sm text-stone-500">Materiały i inne przydatne strony.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {LINKS.map((link, index) => (
          <motion.li
            key={link.href}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.04 }}
          >
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
            >
              <span className="block">{link.title}</span>
              {link.note && <span className="mt-0.5 block text-xs font-medium text-stone-500">{link.note}</span>}
            </a>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
