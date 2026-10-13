self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || "Nowa rezerwacja"
  const options = {
    body: data.body || "Ktoś zarezerwował lekcję.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "rezerwacja",
    data: { url: "/" },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) return client.focus()
      }
      return self.clients.openWindow("/")
    }),
  )
})
