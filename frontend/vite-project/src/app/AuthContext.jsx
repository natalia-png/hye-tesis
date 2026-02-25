// src/app/AuthContext.jsx
import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { fetchUserProfile } from "../lib/firestore";
import { Ctx } from "./auth-ctx";
import { usePushNotifications } from "../hooks/usePushNotifications.js";

// ── Toast de notificación en primer plano ──
function ForegroundToast({ notif, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!notif) return null;

  const icons = {
    phase_done: "✓",
    phase_started: "→",
    progress_update: "↑",
  };

  const type = notif.data?.type || "progress_update";

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-2rem)] max-w-[460px]
                 bg-[#141414] text-ivory rounded-2xl shadow-xl border border-white/10
                 flex items-start gap-3 px-4 py-3 animate-[slideDown_0.3s_ease]"
      style={{ animation: "slideDown 0.3s ease" }}
    >
      <div className="w-7 h-7 rounded-full bg-ivory/15 flex items-center justify-center flex-shrink-0 text-[13px] font-bold mt-0.5">
        {icons[type] || "·"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-tight">
          {notif.notification?.title || "Actualización de proyecto"}
        </p>
        <p className="text-[12px] text-ivory/65 mt-0.5 leading-snug">
          {notif.notification?.body || ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-ivory/40 hover:text-ivory text-[18px] leading-none flex-shrink-0 mt-0.5"
      >
        ×
      </button>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [foregroundNotif, setForegroundNotif] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      setReady(false);

      if (!fbUser) {
        setUser(null);
        setReady(true);
        return;
      }

      try {
        await fbUser.getIdToken(true);

        // Reintentar hasta 5 veces si el perfil no tiene rol aún
        // (puede tardar unos segundos si lo creó Cloud Function)
        let p = null;
        for (let i = 0; i < 5; i++) {
          p = await fetchUserProfile(fbUser.uid);
          if (p?.role) break;
          await new Promise(r => setTimeout(r, 1000));
        }

        setUser({
          uid: fbUser.uid,
          email: (fbUser.email || "").trim().toLowerCase(),
          name: fbUser.displayName || p?.name || "Usuario",
          role: (p?.role || "sin-rol").toLowerCase(),
          subRole: (p?.subRole || "").toLowerCase(),
        });
      } catch (e) {
        console.error("Perfil/rol:", e);
        setUser({
          uid: fbUser.uid,
          email: (fbUser.email || "").trim().toLowerCase(),
          name: "Usuario",
          role: "sin-rol",
          subRole: "",
        });
      } finally {
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  // ── Activar push notifications cuando hay usuario logueado ──
  const handleForegroundMessage = useCallback(payload => {
    setForegroundNotif(payload);
  }, []);

  const { permissionStatus, requestPermission } = usePushNotifications(user?.uid || null, handleForegroundMessage);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <Ctx.Provider value={{ user, ready, login, logout, permissionStatus, requestPermission }}>
      {children}

      {/* Toast de notificación con app abierta */}
      <ForegroundToast
        notif={foregroundNotif}
        onClose={() => setForegroundNotif(null)}
      />
    </Ctx.Provider>
  );
}