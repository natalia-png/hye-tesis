import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { fetchUserProfile } from "../lib/firestore";
import { Ctx } from "./auth-ctx";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setReady(true);
        return;
      }
      try {
        const p = await fetchUserProfile(fbUser.uid); // { name, role, email? }
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName || p?.name || "Usuario",
          role: (p?.role || "sin-rol").toLowerCase(), // ⬅️ estandariza
        });
      } catch (e) {
        console.error("Perfil/rol:", e);
        setUser({ uid: fbUser.uid, email: fbUser.email, name: "Usuario", role: "sin-rol" });
      }
      setReady(true);
    });
    return () => unsub();
  }, []);

  const login  = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}
