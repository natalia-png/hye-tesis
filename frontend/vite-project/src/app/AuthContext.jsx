// src/app/AuthContext.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { fetchUserProfile } from "../lib/firestore";
import { Ctx } from "./auth-ctx";
import { usePushNotifications } from "../hooks/usePushNotifications.js";
import PropTypes from "prop-types";

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
    let profileUnsub = null;

    const unsub = onAuthStateChanged(auth, async fbUser => {
      // Cancelar listener de perfil anterior
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      setReady(false);

      if (!fbUser) {
        setUser(null);
        setReady(true);
        return;
      }

      try {
        await fbUser.getIdToken(true);

        // Carga inicial con reintentos (Cloud Function puede tardar en crear el perfil)
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

        // Listener en tiempo real: si el admin cambia el rol mientras hay sesión activa,
        // la UI se actualiza automáticamente sin necesidad de cerrar sesión
        profileUnsub = onSnapshot(doc(db, "users", fbUser.uid), snap => {
          if (!snap.exists()) return;
          const data = snap.data();
          setUser(prev => prev ? {
            ...prev,
            role: (data.role || prev.role).toLowerCase(),
            subRole: (data.subRole || "").toLowerCase(),
            name: data.name || prev.name,
          } : prev);
        });

      } catch (e) {
        console.error(e);
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

    return () => {
      try { unsub(); } catch (e) { console.error(e); }
      try { if (profileUnsub) { profileUnsub(); } } catch (e) { console.error(e); }
    };
  }, []);

  // ── Activar push notifications cuando hay usuario logueado ──
  const handleForegroundMessage = useCallback(payload => {
    setForegroundNotif(payload);
  }, []);

  const { permissionStatus, requestPermission } = usePushNotifications(user?.uid || null, handleForegroundMessage);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const ctxValue = useMemo(
    () => ({ user, ready, login, logout, permissionStatus, requestPermission }),
    [user, ready, login, logout, permissionStatus, requestPermission]
  );

  return (
    <Ctx.Provider value={ctxValue}>
      {children}

      {/* Toast de notificación con app abierta */}
      <ForegroundToast
        notif={foregroundNotif}
        onClose={() => setForegroundNotif(null)}
      />
    </Ctx.Provider>
  );
}

ForegroundToast.propTypes = {
  notif: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};