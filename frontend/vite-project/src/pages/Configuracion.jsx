import { useEffect, useMemo, useState } from "react";
import { updateProfile } from "firebase/auth";
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

      <div className="card space-y-4">
        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "rgb(var(--ink) / 0.4)" }}>
          Apariencia
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themeOptions.map((option) => {
            const active = currentTheme === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className={`rounded-2xl border p-3 text-left transition ${active ? "ring-2 ring-ink/20" : "hover:-translate-y-0.5"}`}
                style={{
                  borderColor: active ? "rgb(var(--ink) / 0.35)" : "rgb(var(--taupe) / 0.3)",
                  background: "rgb(var(--sand) / 0.28)",
                }}
              >
                <div className={`rounded-xl border p-3 ${option.cardClass}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={`text-[12px] font-semibold ${option.id === "dark" ? "text-[#EDE9E0]" : "text-[#111111]"}`}>
                        {option.title}
                      </p>
                      <p className={`text-[10px] ${option.id === "dark" ? "text-[#EDE9E0]/60" : "text-[#111111]/50"}`}>
                        {option.subtitle}
                      </p>
                    </div>
                    <span className={`text-[9px] px-2 py-1 rounded-full ${option.chipClass}`}>
                      {active ? "Activo" : "Aplicar"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className={`h-2 w-20 rounded-full ${option.barClass}`} />
                    <div className={`h-8 rounded-lg ${option.lineClass}`} />
                    <div className="flex gap-2">
                      <div className={`h-14 flex-1 rounded-lg ${option.lineClass}`} />
                      <div className={`h-14 flex-1 rounded-lg ${option.lineClass}`} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px]" style={{ color: "rgb(var(--ink) / 0.5)" }}>
          La vista previa ahora aplica el tema al tocar cada tarjeta.
        </p>
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

      <div className="pt-2">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-2xl px-4 py-3 text-[13px] font-semibold border transition active:scale-[0.99]"
          style={{
            background: "rgb(var(--ink))",
            borderColor: "rgb(var(--ink) / 0.15)",
            color: "rgb(var(--ivory))",
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
