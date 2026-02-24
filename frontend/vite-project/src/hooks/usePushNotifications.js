// src/hooks/usePushNotifications.js
import { useEffect, useRef, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, getMessagingInstance } from "../lib/firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Standalone — fuera del hook para evitar problemas de closure
async function saveToken(userId, token) {
  await setDoc(
    doc(db, "users", userId, "fcmTokens", token),
    { token, updatedAt: serverTimestamp(), userAgent: navigator.userAgent },
    { merge: true }
  );
}

async function registerSW() {
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export function usePushNotifications(uid, onForegroundMessage) {
  const swRef = useRef(null);   // <-- ref, nunca state
  const unsubRef = useRef(null);
  const cbRef = useRef(onForegroundMessage);
  cbRef.current = onForegroundMessage;

  const [permissionStatus, setPermissionStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // Init silenciosa: registra SW y saca token si ya hay permiso
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging || cancelled) return;

        const reg = await registerSW();
        if (cancelled) return;
        swRef.current = reg;   // guardar en ref — disponible INMEDIATAMENTE

        if (Notification.permission === "granted") {
          const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg,
          });
          if (token && !cancelled) {
            await saveToken(uid, token);
            console.log("[Push] Init token OK");
          }
          if (!unsubRef.current) {
            unsubRef.current = onMessage(messaging, p => {
              if (!cancelled) cbRef.current?.(p);
            });
          }
        }
      } catch (e) {
        if (!cancelled) console.warn("[Push] Init:", e.message);
      }
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, [uid]);

  const requestPermission = useCallback(async () => {
    try {
      if (!uid) { console.warn("[Push] Sin uid"); return false; }

      // swRef.current siempre tiene el valor actual — sin problema de closure
      if (!swRef.current) {
        console.log("[Push] Registrando SW...");
        swRef.current = await registerSW();
      }

      console.log("[Push] Pidiendo permiso al navegador...");
      const permission = await Notification.requestPermission();
      console.log("[Push] Resultado:", permission);
      setPermissionStatus(permission);

      if (permission !== "granted") return false;

      const messaging = await getMessagingInstance();
      if (!messaging) { console.warn("[Push] Sin messaging"); return false; }

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRef.current,
      });

      if (!token) { console.warn("[Push] Sin token"); return false; }

      console.log("[Push] Token:", token.slice(0, 20) + "...");
      await saveToken(uid, token);

      if (!unsubRef.current) {
        unsubRef.current = onMessage(messaging, p => cbRef.current?.(p));
      }

      return true;
    } catch (e) {
      console.error("[Push] Error:", e);
      return false;
    }
  }, [uid]); // solo uid — swRef es ref, no necesita estar en deps

  return { permissionStatus, requestPermission };
}