self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "Agenda Fácil",
      body: "Você tem uma nova notificação"
    };
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: data.url || "/dashboard.html"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
