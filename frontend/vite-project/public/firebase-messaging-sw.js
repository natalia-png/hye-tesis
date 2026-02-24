// public/firebase-messaging-sw.js
// @ts-nocheck
/* global importScripts, firebase, self, clients */

// ⚠️  Este archivo DEBE estar en /public/ (no en /src/)
// Los "errores" que muestra VSCode son falsos — el SW corre en contexto de navegador,
// no en Node. self, clients e importScripts son globales válidas en Service Workers.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// ── Config inyectada desde usePushNotifications.js via postMessage ──
// O usa los valores directos de tu firebaseConfig como fallback
self.addEventListener("message", event => {
  if (event.data?.type === "__FIREBASE_CONFIG__" && !self.__configLoaded) {
    self.__configLoaded = true;
    try {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      setupMessaging(messaging);
    } catch (_) { /* ya inicializado */ }
  }
});

// Fallback: inicializa con valores hardcodeados si el postMessage no llega
// (esto pasa cuando la notificación llega con la app cerrada)
try {
  firebase.initializeApp({
    apiKey:            "AIzaSyA_Aa1dhQdXSR5UD4lk-SdH-dCjLe8_EIE",
    authDomain:        "hye-tesis.firebaseapp.com",
    projectId:         "hye-tesis",
    storageBucket:     "hye-tesis.firebasestorage.app",
    messagingSenderId: "537325686353",
    appId:             "1:537325686353:web:b71d60c6210af7d6b77270",
  });
  const messaging = firebase.messaging();
  setupMessaging(messaging);
} catch (_) { /* ya inicializado por postMessage */ }

function setupMessaging(messaging) {
  // ── Notificación con app en SEGUNDO PLANO o CERRADA ──
  messaging.onBackgroundMessage(payload => {
    const notification = payload.notification || {};
    const data         = payload.data         || {};

    self.registration.showNotification(notification.title || "H&E Arquitectos", {
      body:    notification.body  || "Tienes una actualización en tu proyecto.",
      icon:    "/logo-header.png",
      badge:   "/logo-header.png",
      tag:     data.projectId    || "hye-notif",
      data:    data,
      vibrate: [200, 100, 200],
    });
  });
}

// ── Click en la notificación ──
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const projectId = event.notification.data?.projectId;
  const role      = event.notification.data?.role || "cliente";
  const base      = role === "admin" ? "/proyectos" : "/mis-proyectos";
  const url       = projectId
    ? `${self.location.origin}${base}/${projectId}`
    : self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) clients.openWindow(url);
    })
  );
});