// src/hooks/usePushNotifications.js
import { useEffect, useRef, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, getMessagingInstance, firebaseConfig } from "../lib/firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BA3qpDeenkxzqQrLWz5mxB9-sO2S4klLkVdKKJOAh7LMpt-UIQ9UbKm7sfnRcGG511Vh68WV11DJ4RZUreshQv8";

export function usePushNotifications(uid, onForegroundMessage) {
  const unsubRef = useRef(null);
  const [permissionStatus, setPermissionStatus] = useState(Notification.permission);
  const [serviceWorkerReg, setServiceWorkerReg] = useState(null);

  // Inicialización (silenciosa)
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    const init = async () => {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging || cancelled) return;

        // Registrar SW
        const swReg = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );
        await navigator.serviceWorker.ready;
        setServiceWorkerReg(swReg);

        if (swReg.active) {
          swReg.active.postMessage({
            type: "__FIREBASE_CONFIG__",
            config: firebaseConfig,
          });
        }

        // Si ya hay permisos otorgados, escuchamos onMessage y refrescamos el token
        if (Notification.permission === "granted") {
          const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
          if (token && !cancelled) {
            await saveTokenToFirestore(uid, token);
          }

          unsubRef.current = onMessage(messaging, payload => {
            if (cancelled) return;
            onForegroundMessage?.(payload);
          });
        }
      } catch (err) {
        if (!cancelled) console.warn("Push notifications (init):", err.message);
      }
    };
    init();

    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, [uid, onForegroundMessage]);

  const saveTokenToFirestore = async (userId, token) => {
    await setDoc(
      doc(db, "users", userId, "fcmTokens", token),
      {
        token,
        updatedAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        platform: navigator.platform || "web",
      },
      { merge: true }
    );
  };

  // Función manual (para atar a un click de botón)
  const requestPermission = useCallback(async () => {
    try {
      if (!uid || !serviceWorkerReg) throw new Error("Aún no está listo el servicio o no hay usuario.");

      const permission = await window.Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const messaging = await getMessagingInstance();
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: serviceWorkerReg,
        });

        if (token) {
          await saveTokenToFirestore(uid, token);

          // Activamos el listener que no se activó en el mount inicial por falta de permisos
          if (!unsubRef.current) {
            unsubRef.current = onMessage(messaging, payload => onForegroundMessage?.(payload));
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Error pidiendo permiso de notificaciones:", err);
      return false;
    }
  }, [uid, serviceWorkerReg, onForegroundMessage]);

  return { permissionStatus, requestPermission };
}