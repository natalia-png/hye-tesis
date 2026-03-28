// src/hooks/usePushNotifications.js
import { useEffect, useRef, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, getMessagingInstance } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const IS_NATIVE = Capacitor.isNativePlatform();

// ── Guardar token FCM en Firestore ─────────────────────────────
async function saveToken(userId, token, platform = "web") {
  await setDoc(
    doc(db, "users", userId, "fcmTokens", token),
    { token, platform, updatedAt: serverTimestamp(), userAgent: navigator.userAgent },
    { merge: true }
  );
}

// ── Registrar service worker (solo web) ───────────────────────
async function registerSW() {
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

// ── NATIVO: inicializar si ya hay permiso ─────────────────────
async function initNativePush(uid) {
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === "granted") {
      const { token } = await FirebaseMessaging.getToken();
      if (token) await saveToken(uid, token, "android");
      return "granted";
    }
    // "prompt" = aún no se ha pedido, tratarlo como "default" para mostrar el banner
    return receive === "prompt" ? "default" : receive;
  } catch (e) {
    console.error(e);
    return "default";
  }
}

// ── NATIVO: pedir permiso y obtener token ─────────────────────
async function requestNativePermission(uid) {
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== "granted") return false;
  const { token } = await FirebaseMessaging.getToken();
  if (!token) return false;
  await saveToken(uid, token, "android");
  return true;
}

// ══════════════════════════════════════════════════════════════
export function usePushNotifications(uid, onForegroundMessage) {
  const swRef    = useRef(null);
  const unsubRef = useRef(null);
  const cbRef    = useRef(onForegroundMessage);
  cbRef.current  = onForegroundMessage;

  const [permissionStatus, setPermissionStatus] = useState(() => {
    if (IS_NATIVE) return "default"; // se actualiza en el effect
    return typeof Notification !== "undefined" ? Notification.permission : "default";
  });

  // ── Init silenciosa ──────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      if (IS_NATIVE) {
        // Nativo: verificar permiso actual y registrar token si ya está concedido
        const status = await initNativePush(uid);
        if (cancelled) { return; }
        setPermissionStatus(status);

        // Escuchar mensajes en foreground
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        FirebaseMessaging.addListener("notificationReceived", ({ notification }) => {
          if (!cancelled) cbRef.current?.({ data: notification.data });
        });
      } else {
        // Web: registrar SW y obtener token si ya hay permiso
        try {
          const messaging = await getMessagingInstance();
          if (!messaging || cancelled) return;

          const reg = await registerSW();
          if (cancelled) return;
          swRef.current = reg;

          if (Notification.permission === "granted") {
            const token = await getToken(messaging, {
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: reg,
            });
            if (token && !cancelled) await saveToken(uid, token);

            if (!unsubRef.current) {
              unsubRef.current = onMessage(messaging, p => {
                if (!cancelled) cbRef.current?.(p);
              });
            }
          }
        } catch (e) { console.error("Push init error:", e.message || e); }
      }
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, [uid]);

  // ── Pedir permiso (llamado por el usuario) ───────────────────
  const requestPermission = useCallback(async () => {
    try {
      if (!uid) return false;

      if (IS_NATIVE) {
        const ok = await requestNativePermission(uid);
        setPermissionStatus(ok ? "granted" : "denied");
        return ok;
      }

      // Web
      if (!swRef.current) swRef.current = await registerSW();

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission !== "granted") return false;

      const messaging = await getMessagingInstance();
      if (!messaging) return false;

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRef.current,
      });
      if (!token) return false;

      await saveToken(uid, token);

      if (!unsubRef.current) {
        unsubRef.current = onMessage(messaging, p => cbRef.current?.(p));
      }

      return true;
    } catch (e) {
      console.error("requestPermission error:", e.message || e);
      return false;
    }
  }, [uid]);

  return { permissionStatus, requestPermission };
}
