import { useEffect, useMemo, useState } from "react";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../lib/firebase";
import { useTheme } from "../app/ThemeContext.jsx";
import { useAuth } from "../app/useAuth";
import Avatar from "../components/ui/Avatar.jsx";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export default function Configuracion() {
  const { dark, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [previewURL, setPreviewURL] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoSuccess, setPhotoSuccess] = useState("");

  useEffect(() => {
    return () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
    };
  }, [previewURL]);

  const currentTheme = dark ? "dark" : "light";
  const displayedPhoto = previewURL || user?.photoURL || "";

  const themeOptions = useMemo(() => ([
    {
      id: "light",
      title: "Tema claro",
      subtitle: "Paleta beige natural",
      cardClass: "bg-[#F7F6F2] border-[#d9d1c6]",
      barClass: "bg-[#141414]/12",
      lineClass: "bg-[#141414]/8",
      chipClass: "bg-[#141414] text-[#F7F6F2]",
    },
    {
      id: "dark",
      title: "Tema oscuro",
      subtitle: "Paleta carbon calido",
      cardClass: "bg-[#252320] border-[#3a3731]",
      barClass: "bg-[#EDE9E0]/18",
      lineClass: "bg-[#EDE9E0]/12",
      chipClass: "bg-[#EDE9E0] text-[#1A1917]",
    },
  ]), []);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPhotoError("");
    setPhotoSuccess("");

    if (!file || !user?.uid) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Selecciona una imagen valida.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setPhotoError("La foto no debe superar 2 MB.");
      return;
    }

    if (previewURL) URL.revokeObjectURL(previewURL);
    const localPreview = URL.createObjectURL(file);
    setPreviewURL(localPreview);
    setSavingPhoto(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `profilePhotos/${user.uid}/avatar-${Date.now()}.${ext}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: user.name || auth.currentUser.displayName || "Usuario",
          photoURL: url,
        });
      }

      await updateDoc(doc(db, "users", user.uid), {
        photoURL: url,
        updatedAt: serverTimestamp(),
      });

      const chatsSnap = await getDocs(query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid),
        limit(50)
      ));

      await Promise.allSettled(
        chatsSnap.docs.map((chatDoc) => updateDoc(chatDoc.ref, {
          [`participantPhotos.${user.uid}`]: url,
          [`participantNames.${user.uid}`]: user.name || user.email || "Usuario",
        }))
      );

      setPreviewURL("");
      setPhotoSuccess("Foto de perfil actualizada.");
    } catch (e) {
      console.error(e);
      setPhotoError("No se pudo guardar la foto. Intenta de nuevo.");
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: "rgb(var(--ink) / 0.4)" }}>
          Ajustes
        </p>
        <h1 className="text-[20px] font-bold leading-tight" style={{ color: "rgb(var(--ink))" }}>
          Configuracion
        </h1>
      </div>

      <div className="card space-y-4">
        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "rgb(var(--ink) / 0.4)" }}>
          Cuenta
        </p>

        <div className="flex items-center gap-3">
          <Avatar
            name={user?.name || "Usuario"}
            photoURL={displayedPhoto}
            size={56}
            textClassName="text-[18px]"
          />

          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold truncate" style={{ color: "rgb(var(--ink))" }}>
              {user?.name || "Usuario"}
            </p>
            <p className="text-[12px] truncate" style={{ color: "rgb(var(--ink) / 0.5)" }}>
              {user?.email || ""}
            </p>
          </div>

          <span
            className="text-[10px] font-medium capitalize px-2 py-1 rounded-full border flex-shrink-0"
            style={{
              background: "rgb(var(--sand))",
              borderColor: "rgb(var(--taupe) / 0.4)",
              color: "rgb(var(--ink) / 0.7)",
            }}
          >
            {user?.role || ""}
          </span>
        </div>

        <div className="rounded-2xl border border-dashed px-4 py-3 space-y-3" style={{ borderColor: "rgb(var(--taupe) / 0.45)" }}>
          <div>
            <p className="text-[13px] font-medium" style={{ color: "rgb(var(--ink))" }}>
              Foto de perfil
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: "rgb(var(--ink) / 0.5)" }}>
              Se guardara en tu perfil y se mostrara en encabezado, mensajes y otras vistas compartidas.
            </p>
          </div>

          <label
            htmlFor="profile-photo"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium border cursor-pointer transition hover:bg-ink/5"
            style={{
              borderColor: "rgb(var(--taupe) / 0.4)",
              color: "rgb(var(--ink))",
            }}
          >
            <span>{savingPhoto ? "Subiendo..." : "Cambiar foto"}</span>
          </label>
          <input
            id="profile-photo"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={savingPhoto}
            onChange={handleFileChange}
          />

          {photoError && (
            <p className="text-[11px] text-red-500">{photoError}</p>
          )}
          {photoSuccess && (
            <p className="text-[11px] text-emerald-600">{photoSuccess}</p>
          )}
        </div>
      </div>

      {user?.role === "colaborador" && (
        <div className="card space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "rgb(var(--ink) / 0.4)" }}>
              Mi contrato
            </p>
            <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: "rgb(var(--ink) / 0.5)" }}>
              Documento oficial de tu vinculación con H&amp;E
            </p>
          </div>

          {user?.contratoURL ? (
            <div className="space-y-2">
              <p className="text-[12px]" style={{ color: "rgb(var(--ink) / 0.6)" }}>Documento disponible</p>
              <button
                type="button"
                onClick={() => window.open(user.contratoURL, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium border transition hover:bg-ink/5"
                style={{ borderColor: "rgb(var(--taupe) / 0.4)", color: "rgb(var(--ink))" }}
              >
                Ver contrato
              </button>
            </div>
          ) : (
            <p className="text-[12px] italic" style={{ color: "rgb(var(--ink) / 0.4)" }}>
              El administrador aún no ha subido tu contrato.
            </p>
          )}

          {(user?.telefono || user?.cedula) && (
            <div className="space-y-1 border-t pt-2" style={{ borderColor: "rgb(var(--taupe) / 0.3)" }}>
              {user?.telefono && <InfoRow label="Teléfono" value={user.telefono} />}
              {user?.cedula && <InfoRow label="Cédula" value={user.cedula} />}
            </div>
          )}
        </div>
      )}

      <div className="card space-y-4">
        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "rgb(var(--ink) / 0.4)" }}>
          Apariencia
        </p>

        <div className="flex flex-col gap-2">
          {themeOptions.map((option) => {
            const active = currentTheme === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition"
                style={{
                  borderColor: active ? "rgb(var(--ink) / 0.35)" : "rgb(var(--taupe) / 0.25)",
                  background: active ? "rgb(var(--ink) / 0.06)" : "transparent",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg border flex-shrink-0 ${option.cardClass}`} />
                  <div className="text-left">
                    <p className="text-[12px] font-medium" style={{ color: "rgb(var(--ink))" }}>{option.title}</p>
                    <p className="text-[10px]" style={{ color: "rgb(var(--ink) / 0.45)" }}>{option.subtitle}</p>
                  </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${option.chipClass}`}>
                  {active ? "Activo" : "Aplicar"}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      <div className="card space-y-3">
        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "rgb(var(--ink) / 0.4)" }}>
          Acerca de
        </p>
        <div className="space-y-2">
          <InfoRow label="Aplicacion" value="H&E Arquitectos" />
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Plataforma" value="Web · Android" />
        </div>
      </div>

      {user?.role === "admin" && <SeccionSeguridad />}

      <div className="pt-2">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-2xl px-4 py-3 text-[13px] font-semibold border transition active:scale-[0.99]"
          style={{
            background: dark ? "#EDE9E0" : "rgb(var(--ink))",
            borderColor: dark ? "rgb(237 233 224 / 0.35)" : "rgb(var(--ink) / 0.15)",
            color: dark ? "#1A1917" : "rgb(var(--ivory))",
          }}
        >
          Cerrar sesion
        </button>
      </div>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px]" style={{ color: "rgb(var(--ink) / 0.55)" }}>{label}</span>
      <span className="text-[13px] font-medium" style={{ color: "rgb(var(--ink))" }}>{value}</span>
    </div>
  );
}

function SeccionSeguridad() {
  const [abierto, setAbierto] = useState(false);
  const [contraActual, setContraActual] = useState("");
  const [nuevaContra, setNuevaContra] = useState("");
  const [confirmaContra, setConfirmaContra] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const reset = () => {
    setAbierto(false);
    setContraActual("");
    setNuevaContra("");
    setConfirmaContra("");
    setError("");
    setOk("");
  };

  const handlePassword = async () => {
    if (!contraActual) return setError("Escribe tu contraseña actual.");
    if (!nuevaContra) return setError("Escribe la nueva contraseña.");
    if (nuevaContra.length < 6) return setError("Mínimo 6 caracteres.");
    if (nuevaContra !== confirmaContra) return setError("Las contraseñas no coinciden.");
    setSaving(true); setError("");
    try {
      const fbUser = auth.currentUser;
      const cred = EmailAuthProvider.credential(fbUser.email, contraActual);
      await reauthenticateWithCredential(fbUser, cred);
      await updatePassword(fbUser, nuevaContra);
      setOk("Contraseña actualizada correctamente.");
      setTimeout(reset, 2500);
    } catch (e) {
      const msgs = {
        "auth/wrong-password": "Contraseña actual incorrecta.",
        "auth/invalid-credential": "Contraseña actual incorrecta.",
        "auth/requires-recent-login": "Cierra sesión, vuelve a entrar e inténtalo de nuevo.",
      };
      setError(msgs[e.code] || "Error al actualizar la contraseña.");
    } finally { setSaving(false); }
  };

  return (
    <div className="card space-y-3">
      <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "rgb(var(--ink) / 0.4)" }}>
        Seguridad
      </p>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border transition"
          style={{ borderColor: "rgb(var(--taupe) / 0.25)" }}
        >
          <span className="text-[13px]" style={{ color: "rgb(var(--ink))" }}>Cambiar contraseña</span>
          <span className="text-[12px]" style={{ color: "rgb(var(--ink) / 0.4)" }}>›</span>
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] font-medium" style={{ color: "rgb(var(--ink))" }}>Cambiar contraseña</p>

          <div className="space-y-1">
            <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.5)" }}>Contraseña actual</label>
            <input
              type="password"
              value={contraActual}
              onChange={e => setContraActual(e.target.value)}
              className="input w-full text-[13px]"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.5)" }}>Nueva contraseña</label>
            <input
              type="password"
              value={nuevaContra}
              onChange={e => setNuevaContra(e.target.value)}
              className="input w-full text-[13px]"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.5)" }}>Confirmar contraseña</label>
            <input
              type="password"
              value={confirmaContra}
              onChange={e => setConfirmaContra(e.target.value)}
              className="input w-full text-[13px]"
              placeholder="Repite la nueva contraseña"
            />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
          {ok && <p className="text-[12px] text-emerald-600">{ok}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={reset} disabled={saving} className="flex-1 btn-outline text-[13px]">
              Cancelar
            </button>
            <button type="button" onClick={handlePassword} disabled={saving} className="flex-1 btn-primary text-[13px] disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
