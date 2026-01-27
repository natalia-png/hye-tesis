// src/components/ArchivosFase.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where, // ✅ IMPORTANTE
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../app/useAuth";

export default function ArchivosFase({
  projectId,
  phaseId,
  canEdit = false, // admin true
  clientView = false, // cliente true
}) {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const inputRef = useRef(null);

  // ✅ evita “error fantasma” cuando ya cargó una vez
  const hadSuccessRef = useRef(false);

  const colRef = useMemo(() => {
    if (!projectId || !phaseId) return null;
    return collection(db, "projects", projectId, "fases", phaseId, "archivos");
  }, [projectId, phaseId]);

  // ✅ Realtime list (CORRECTO CON REGLAS)
  useEffect(() => {
    setItems([]);
    setError("");
    setOk("");
    hadSuccessRef.current = false;

    if (!colRef) return;

    // ✅ Cliente: consultar SOLO visibles (si no, Firestore tumba la query por permisos)
    const qs = clientView
      ? query(
          colRef,
          where("visibleToClient", "==", true),
          orderBy("createdAt", "desc"),
          limit(50)
        )
      : query(colRef, orderBy("createdAt", "desc"), limit(50));

    const unsub = onSnapshot(
      qs,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            ...data,
            visibleToClient: data.visibleToClient === true,
          };
        });

        setItems(list);

        hadSuccessRef.current = true;
        setError("");
      },
      (e) => {
        console.error(e);

        // si ya cargó alguna vez, no ensucies la UI
        if (hadSuccessRef.current) return;

        setError("No se pudieron cargar los archivos.");
      }
    );

    return () => unsub();
  }, [colRef, clientView]);

  const pickFile = () => {
    if (!canEdit) return;
    setError("");
    setOk("");
    inputRef.current?.click();
  };

  const onSelectFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset input
    if (!file) return;

    // ✅ controles básicos
    const MAX_MB = 15;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Máximo ${MAX_MB}MB por archivo.`);
      return;
    }

    if (!colRef) {
      setError("No se encontró la fase para subir archivos.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setError("");
    setOk("");

    try {
      // 1) Doc ID fijo para que fileId == storage object name
      const fileDoc = doc(colRef); // ID sin escribir aún
      const fileId = fileDoc.id;

      // ✅ storagePath exacto y estable
      const storagePath = `phaseFiles/${projectId}/${phaseId}/${fileId}`;
      const sRef = storageRef(storage, storagePath);

      // 2) metadata (Firestore) - se crea ANTES del upload para trazabilidad
      await setDoc(fileDoc, {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        storagePath,
        visibleToClient: false,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || "unknown",
      });

      // 3) subir a Storage
      const task = uploadBytesResumable(sRef, file, {
        contentType: file.type || undefined,
      });

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100
            );
            setProgress(pct);
          },
          reject,
          resolve
        );
      });

      // ✅ 4) obtener URL con token y guardarla en Firestore
      const downloadURL = await getDownloadURL(sRef);
      await updateDoc(fileDoc, { downloadURL });

      setOk("✅ Archivo subido. Ahora puedes marcarlo como visible para el cliente.");
      setTimeout(() => setOk(""), 2500);
    } catch (e2) {
      console.error(e2);
      setError("No se pudo subir el archivo. Revisa permisos o conexión.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const onToggleVisible = async (id, current) => {
    if (!canEdit || !colRef) return;

    setBusy(true);
    setError("");
    setOk("");

    try {
      await updateDoc(doc(colRef, id), { visibleToClient: !current });
      setOk(!current ? "Visible para cliente ✅" : "Oculto para cliente ✅");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      console.error(e);
      setError("No se pudo actualizar la visibilidad.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (file) => {
    if (!canEdit || !colRef) return;

    const sure = confirm(
      `¿Eliminar "${file.fileName}"? Esta acción no se puede deshacer.`
    );
    if (!sure) return;

    setBusy(true);
    setError("");
    setOk("");

    try {
      // ✅ borrar Storage (SIEMPRE por storagePath)
      if (file.storagePath) {
        await deleteObject(storageRef(storage, file.storagePath));
      }

      // borrar Firestore
      await deleteDoc(doc(colRef, file.id));

      setOk("Archivo eliminado ✅");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      console.error(e);
      setError("No se pudo eliminar el archivo (Storage o Firestore).");
    } finally {
      setBusy(false);
    }
  };

  // ✅ DESCARGA: cliente por downloadURL, admin fallback storagePath
  const onDownload = async (file) => {
    try {
      // Cliente: SOLO por downloadURL (no toca Storage SDK => evita 403)
      if (clientView) {
        if (!file?.downloadURL) {
          setError("Este archivo aún no está publicado para descarga del cliente.");
          return;
        }
        window.open(file.downloadURL, "_blank", "noopener,noreferrer");
        return;
      }

      // Admin: si existe downloadURL úsala, si no usa storagePath (legacy)
      if (file?.downloadURL) {
        window.open(file.downloadURL, "_blank", "noopener,noreferrer");
        return;
      }

      if (!file?.storagePath) return;
      const url = await getDownloadURL(storageRef(storage, file.storagePath));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      setError("No se pudo descargar. Revisa permisos/visibilidad.");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-sand bg-white/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-ink">Archivos</p>
          <p className="text-[11px] text-ink/60">
            {clientView
              ? "Documentos asociados a esta fase (solo visibles para el cliente)."
              : "Sube planos, actas o entregables. Controla qué ve el cliente."}
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={onSelectFile}
            />
            <button
              type="button"
              className="btn-primary text-[12px]"
              onClick={pickFile}
              disabled={busy}
            >
              {busy ? "Procesando…" : "Subir archivo"}
            </button>
          </div>
        )}
      </div>

      {busy && progress > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-ink/60 mb-1">Subiendo… {progress}%</p>
          <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
            <div className="h-full bg-ink" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      {ok && <p className="mt-2 text-[12px] text-ink/70">{ok}</p>}

      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-[12px] text-ink/60">Aún no hay archivos en esta fase.</p>
        ) : (
          items.map((f) => (
            <div
              key={f.id}
              className="rounded-xl border border-sand bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">
                    {f.fileName || "Archivo"}
                  </p>
                  <p className="text-[11px] text-ink/60 mt-1">
                    {formatSize(f.size)} · {f.contentType || "—"}
                  </p>

                  {!clientView && (
                    <p className="text-[11px] mt-1">
                      <span className="text-ink/50">Visible al cliente: </span>
                      <span className="font-medium text-ink">
                        {f.visibleToClient ? "Sí" : "No"}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-outline text-[12px]"
                    onClick={() => onDownload(f)}
                    disabled={busy}
                  >
                    Descargar
                  </button>

                  {canEdit && !clientView && (
                    <>
                      <button
                        type="button"
                        className="btn-outline text-[12px]"
                        onClick={() => onToggleVisible(f.id, !!f.visibleToClient)}
                        disabled={busy}
                      >
                        {f.visibleToClient ? "Ocultar" : "Mostrar"}
                      </button>

                      <button
                        type="button"
                        className="btn-outline text-[12px]"
                        onClick={() => onDelete(f)}
                        disabled={busy}
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!clientView && canEdit && (
        <p className="mt-2 text-[11px] text-ink/50">
          Tip: por defecto los archivos quedan ocultos. Marca “Mostrar” cuando ya sea apto para cliente.
        </p>
      )}
    </div>
  );
}

function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}