// src/pages/TestFCMToken.jsx
// ⚠️  SOLO PARA DESARROLLO — elimina esta página antes de entregar
// Te muestra el token FCM del dispositivo actual para probar push notifications

import { useState } from "react";
import { getToken } from "firebase/messaging";
import { getMessagingInstance } from "../lib/firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

export default function TestFCMToken() {
  const [token, setToken]   = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const getFCMToken = async () => {
    setStatus("Solicitando permiso...");
    setToken("");

    try {
      // 1. Verificar soporte
      const messaging = await getMessagingInstance();
      if (!messaging) {
        setStatus("❌ Este navegador no soporta notificaciones push.");
        return;
      }

      // 2. Pedir permiso
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("❌ Permiso denegado. Habilita notificaciones en tu navegador.");
        return;
      }

      setStatus("Registrando Service Worker...");

      // 3. Registrar SW
      const swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" }
      );
      await navigator.serviceWorker.ready;

      setStatus("Obteniendo token FCM...");

      // 4. Obtener token
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (fcmToken) {
        setToken(fcmToken);
        setStatus("✅ Token obtenido. Cópialo para usar en Firebase Console.");
      } else {
        setStatus("❌ No se pudo obtener el token. Verifica la VAPID key en .env");
      }
    } catch (err) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-gradient-to-br from-[#141414] via-[#232323] to-[#3a3732] text-ivory p-4 border border-white/10">
        <p className="text-[10px] uppercase tracking-[0.22em] text-ivory/40 font-medium">
          Herramienta de desarrollo
        </p>
        <h1 className="text-[18px] font-bold mt-1">Token FCM</h1>
        <p className="text-[12px] text-ivory/60 mt-0.5">
          Obtén el token de este dispositivo para probar push notifications desde Firebase Console.
        </p>
      </div>

      {/* Paso 1 */}
      <div className="card space-y-2">
        <p className="text-[13px] font-semibold text-ink">Paso 1 — Obtener token</p>
        <p className="text-[12px] text-ink/60">
          Haz clic en el botón. El navegador te pedirá permiso para enviar notificaciones.
          Acepta el permiso.
        </p>
        <button
          type="button"
          className="btn-primary text-[13px] w-full"
          onClick={getFCMToken}
        >
          Obtener mi token FCM
        </button>
        {status && (
          <p className={`text-[12px] mt-1 ${status.startsWith("❌") ? "text-red-600" : status.startsWith("✅") ? "text-green-700" : "text-ink/60"}`}>
            {status}
          </p>
        )}
      </div>

      {/* Token resultado */}
      {token && (
        <div className="card space-y-3">
          <p className="text-[13px] font-semibold text-ink">Paso 2 — Copiar token</p>
          <div className="rounded-xl bg-[#F2EEE7] border border-taupe/30 p-3 break-all">
            <p className="text-[11px] font-mono text-ink/70 leading-relaxed">{token}</p>
          </div>
          <button
            type="button"
            className="btn-primary text-[13px] w-full"
            onClick={copyToken}
          >
            {copied ? "✅ Copiado" : "Copiar token"}
          </button>

          {/* Instrucciones */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <p className="text-[12px] font-semibold text-amber-800">Paso 3 — Usar en Firebase Console</p>
            <ol className="text-[11px] text-amber-700 space-y-1 list-decimal list-inside">
              <li>Ve a Firebase Console → Cloud Messaging → Nueva notificación</li>
              <li>Escribe título y texto</li>
              <li>En "Orientación" → "Enviar mensaje de prueba"</li>
              <li>Pega este token en el campo que aparece</li>
              <li>Haz clic en "Probar"</li>
            </ol>
          </div>
        </div>
      )}

      {/* Nota VAPID */}
      {!VAPID_KEY && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-[12px] font-semibold text-red-700">⚠️ Falta VAPID Key</p>
          <p className="text-[11px] text-red-600 mt-1">
            Agrega <span className="font-mono font-bold">VITE_FIREBASE_VAPID_KEY</span> a tu archivo <span className="font-mono font-bold">.env</span>
          </p>
          <p className="text-[11px] text-red-600 mt-1">
            Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
          </p>
        </div>
      )}
    </div>
  );
}