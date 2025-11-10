// src/components/DocumentosProyecto.jsx
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";

export default function DocumentosProyecto({ projectId, canManage = false }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  // Escuchar documentos del proyecto en tiempo real
  useEffect(() => {
    if (!projectId) return;

    const colRef = collection(db, "projectDocuments");
    // ⬇️ solo filtramos por projectId, sin orderBy (para evitar índices)
    const q = query(colRef, where("projectId", "==", projectId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Ordenamos del lado del cliente por createdAt (más reciente primero)
        list.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setDocs(list);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("Error cargando documentos:", err);
        setError(
          "No se pudieron cargar los documentos. Revisa las reglas de Firestore o vuelve a intentarlo."
        );
        setLoading(false);
      }
    );

    return () => unsub();
  }, [projectId]);

  const resetForm = () => {
    setFile(null);
    setLabel("");
  };

  async function handleUpload(e) {
    e?.preventDefault();
    if (!canManage) return; // seguridad extra
    if (!file) {
      setError("Primero selecciona un archivo.");
      return;
    }

    setError("");

    // límite sencillo para el plan gratis (~10 MB)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError("El archivo es muy pesado (máx. 10 MB).");
      return;
    }

    try {
      setUploading(true);

      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const storagePath = `projects/${projectId}/${Date.now()}-${safeName}`;
      const storageRef = ref(storage, storagePath);

      // 1) Subimos a Storage
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      // 2) Registramos el documento en Firestore
      await addDoc(collection(db, "projectDocuments"), {
        projectId,
        name: label || file.name,
        fileName: file.name,
        url,
        size: file.size,
        storagePath,
        createdAt: serverTimestamp(),
      });

      resetForm();
    } catch (err) {
      console.error("Error subiendo archivo:", err);
      setError("No se pudo subir el archivo. Revisa conexión o permisos.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docItem) {
  if (!canManage) return;

  const ok = window.confirm(
    `¿Eliminar el documento "${docItem.name || docItem.fileName}" para este proyecto?`
  );
  if (!ok) return;

  try {
    // Intentar borrar en Storage si tenemos ruta
    if (docItem.storagePath) {
      const storageRef = ref(storage, docItem.storagePath);
      try {
        await deleteObject(storageRef);
      } catch (err) {
        // Si el archivo ya no existe en Storage, lo ignoramos
        if (err.code !== "storage/object-not-found") {
          console.error("Error borrando en Storage:", err);
          setError("No se pudo eliminar el archivo en Storage.");
          return; // no seguimos para no dar mensajes raros
        }
      }
    }

    // Pase lo que pase con Storage, borramos el registro en Firestore
    await deleteDoc(doc(db, "projectDocuments", docItem.id));
  } catch (err) {
    console.error("Error eliminando documento:", err);
    setError("No se pudo eliminar el documento.");
  }
}


  const formatSize = (size) => {
    if (!size && size !== 0) return "";
    if (size < 1024 * 1024) {
      return `${Math.round(size / 1024)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleDateString("es-ES");
    }
    return "";
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">
            Documentos compartidos
          </h2>
          <p className="text-[11px] text-ink/60">
            {canManage
              ? "Aquí puedes subir planos, memorias y documentos relevantes para este proyecto."
              : "Aquí ves los documentos que el equipo de H&E ha compartido contigo para este proyecto."}
          </p>
        </div>

        {!canManage && (
          <span className="text-[11px] text-ink/50 border border-sand px-2 py-[2px] rounded-full">
            Solo lectura
          </span>
        )}
      </div>

      {/* Zona de subida SOLO para equipo interno (Luisa, etc.) */}
      {canManage && (
        <form
          onSubmit={handleUpload}
          className="border border-dashed border-taupe/40 rounded-xl px-3 py-3 space-y-3 bg-ivory/60"
        >
          <div className="space-y-2">
            <label className="text-[12px] text-ink/70 block">
              Nombre descriptivo (opcional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input w-full text-[13px]"
              placeholder="Ej: Planos arquitectónicos Fase 1"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] text-ink/70 block">
              Archivo a adjuntar (PDF, imágenes, etc.)
            </label>
            <input
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError("");
              }}
              disabled={uploading}
              className="text-[12px] file:mr-3 file:rounded-full file:border-none file:bg-ink file:px-4 file:py-1.5 file:text-ivory file:text-[12px] file:cursor-pointer"
            />
            <p className="text-[11px] text-ink/50">
              Tamaño máximo recomendado: 10&nbsp;MB por archivo.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              disabled={uploading && !file}
              className="text-[12px] text-ink/60 hover:text-ink"
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="btn-primary text-[13px]"
            >
              {uploading ? "Subiendo…" : "Subir documento"}
            </button>
          </div>
        </form>
      )}

      {loading && (
        <p className="text-[12px] text-ink/60">Cargando documentos…</p>
      )}

      {error && (
        <p className="text-[12px] text-red-600">
          {error}
        </p>
      )}

      {/* Lista de documentos */}
      <div className="space-y-2">
        {docs.length === 0 && !loading && (
          <p className="text-[12px] text-ink/60">
            Todavía no hay documentos cargados para este proyecto.
          </p>
        )}

        {docs.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/80 border border-sand px-3 py-2"
          >
            <div className="flex-1">
              <p className="text-[13px] text-ink font-medium truncate">
                {d.name || d.fileName}
              </p>
              <p className="text-[11px] text-ink/50">
                {formatSize(d.size)} {formatDate(d.createdAt) && "·"}{" "}
                {formatDate(d.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {d.url && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-ink/80 underline"
                >
                  Ver
                </a>
              )}

              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDelete(d)}
                  className="text-[11px] text-red-600 hover:text-red-700"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
