// src/components/ArchivosFase.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../app/useAuth";
import PropTypes from "prop-types";

export default function ArchivosFase({
  projectId,
  phaseId,
  canEdit = false,
  canToggleVisibility = false,
  clientView = false,
  currentUserUid = null,
}) {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [listenerStatus, setListenerStatus] = useState("idle");
  const [previewFile, setPreviewFile] = useState(null); // archivo abierto en preview

  const inputRef = useRef(null);
  const hadSuccessRef = useRef(false);

  const colRef = useMemo(() => {
    if (!projectId || !phaseId) return null;
    return collection(db, "projects", projectId, "fases", phaseId, "archivos");
  }, [projectId, phaseId]);

  useEffect(() => {
    setItems([]);
    setError("");
    setOk("");
    hadSuccessRef.current = false;
    setListenerStatus("connecting");

    if (!colRef) {
      setListenerStatus("no-colref");
      return;
    }

    // ✅ Admin ve todos, cliente solo los visibles
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
        setListenerStatus(`ok-${list.length}`); // debug: cuántos docs trajo
      },
      (e) => {
        setListenerStatus(`error-${e.code}`); // debug: qué error dio

        if (hadSuccessRef.current) return;
        setError(`No se pudieron cargar los archivos. (${e.code})`);
      }
    );

    return () => { try { unsub(); } catch (e) { console.error(e); } };
  }, [colRef, clientView]);

  const pickFile = () => {
    if (!canEdit) return;
    setError("");
    setOk("");
    inputRef.current?.click();
  };

  const onSelectFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

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
      const fileDoc = doc(colRef);
      const fileId = fileDoc.id;

      const storagePath = `phaseFiles/${projectId}/${phaseId}/${fileId}`;
      const sRef = storageRef(storage, storagePath);

      await setDoc(fileDoc, {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        storagePath,
        visibleToClient: false,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || "unknown",
      });

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

      const downloadURL = await getDownloadURL(sRef);
      await updateDoc(fileDoc, { downloadURL });

      setOk("✅ Archivo subido. Marca 'Mostrar' para que el cliente lo vea.");
      setTimeout(() => setOk(""), 4000);
    } catch (e) {
      console.error(e);
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
      setOk(current ? "✅ Oculto para cliente." : "✅ Visible para cliente.");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      console.error(e);
      setError("No se pudo actualizar la visibilidad.");
    } finally {
      setBusy(false);
    }
  };

  const canDeleteFile = (file) =>
    canToggleVisibility || (currentUserUid && file.createdBy === currentUserUid);

  const onDelete = async (file) => {
    if (!canDeleteFile(file) || !colRef) return;

    const sure = confirm(
      `¿Eliminar "${file.fileName}"? Esta acción no se puede deshacer.`
    );
    if (!sure) return;

    setBusy(true);
    setError("");
    setOk("");

    try {
      // Intentar borrar de Storage (puede fallar si el archivo es muy viejo)
      if (file.storagePath) {
        try {
          await deleteObject(storageRef(storage, file.storagePath));
        } catch {
          // Si Storage falla por permisos o archivo no existe, continuar igual
          // El documento de Firestore se borra de todas formas
        }
      }
      // Siempre borrar el documento de Firestore
      await deleteDoc(doc(colRef, file.id));
      setOk("Archivo eliminado ✅");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      console.error(e);
      setError("No se pudo eliminar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (file) => {
    try {
      // Usar downloadURL guardado en Firestore (evita llamar Storage directamente)
      if (file?.downloadURL) {
        window.open(file.downloadURL, "_blank", "noopener,noreferrer");
        return;
      }
      if (clientView) {
        setError("Este archivo aún no está publicado para el cliente.");
        return;
      }

      if (file?.downloadURL) {
        window.open(file.downloadURL, "_blank", "noopener,noreferrer");
        return;
      }

      if (!file?.storagePath) return;
      const url = await getDownloadURL(storageRef(storage, file.storagePath));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      setError("No se pudo descargar.");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-sand dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-ink dark:text-white/90">Archivos</p>
          <p className="text-[11px] text-ink/60 dark:text-white/50">
            {clientView
              ? "Documentos de esta fase visibles para ti."
              : "Sube planos, actas o entregables."}
          </p>
        </div>

        {canEdit && !clientView && (
          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" className="hidden" onChange={onSelectFile} />
            <button type="button" className="btn-primary text-[12px] whitespace-nowrap"
              onClick={pickFile} disabled={busy}>
              {busy ? "Procesando..." : "Subir archivo"}
            </button>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      {busy && progress > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-ink/60 dark:text-white/50 mb-1">Subiendo... {progress}%</p>
          <div className="h-2 w-full bg-sand dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-ink dark:bg-white/70" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
      {ok && <p className="mt-2 text-[12px] text-emerald-600 dark:text-emerald-400">{ok}</p>}

      {/* Lista de archivos */}
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-[12px] text-ink/60 dark:text-white/40">
            {listenerStatus.startsWith("error")
              ? "Error al cargar archivos."
              : "Aun no hay archivos en esta fase."}
          </p>
        ) : (
          items.map((f) => (
            <div key={f.id}
              className="rounded-xl border border-sand dark:border-white/10 bg-white dark:bg-white/5 p-3 overflow-hidden">
              <div className="flex flex-col gap-2 min-w-0">
                {/* Info del archivo */}
                <div className="min-w-0 w-full">
                  <p className="text-[13px] font-medium text-ink dark:text-white/90 truncate" title={f.fileName}>
                    {f.fileName || "Archivo"}
                  </p>
                  <p className="text-[11px] text-ink/60 dark:text-white/40 mt-0.5">
                    {formatSize(f.size)} · {f.contentType || "—"}
                  </p>
                  {canToggleVisibility && (
                    <p className="text-[11px] mt-1">
                      <span className="text-ink/50 dark:text-white/40">Visible al cliente: </span>
                      <span className={`font-medium ${f.visibleToClient ? "text-emerald-600 dark:text-emerald-400" : "text-ink/60 dark:text-white/40"}`}>
                        {f.visibleToClient ? "Si" : "No"}
                      </span>
                    </p>
                  )}
                </div>

                {/* Botones */}
                <div className="flex flex-wrap gap-2">
                  {isPreviewable(f.contentType) && f.downloadURL && (
                    <button type="button"
                      className="text-[12px] px-3 py-1.5 rounded-full bg-ink dark:bg-white text-ivory dark:text-ink font-medium hover:opacity-80 transition"
                      onClick={() => setPreviewFile(f)}>
                      Ver
                    </button>
                  )}
                  <button type="button"
                    className="text-[12px] px-3 py-1.5 rounded-full border border-ink/25 dark:border-white/25 text-ink/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition"
                    onClick={() => onDownload(f)} disabled={busy}>
                    Descargar
                  </button>

                  {canToggleVisibility && (
                    <button type="button"
                      className={`text-[12px] px-3 py-1.5 rounded-full border transition ${f.visibleToClient
                        ? "border-ink/25 dark:border-white/25 text-ink/60 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10"
                        : "border-ink dark:border-white bg-ink dark:bg-white text-ivory dark:text-ink hover:opacity-80"}`}
                      onClick={() => onToggleVisible(f.id, f.visibleToClient)} disabled={busy}>
                      {f.visibleToClient ? "Ocultar al cliente" : "Mostrar al cliente"}
                    </button>
                  )}
                  {canDeleteFile(f) && (
                    <button type="button"
                      className="text-[12px] px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      onClick={() => onDelete(f)} disabled={busy}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {canToggleVisibility && (
        <p className="mt-2 text-[11px] text-ink/50 dark:text-white/30">
          Al aprobar una propuesta del colaborador, los archivos de la fase se hacen visibles al cliente automaticamente.
        </p>
      )}

      {/* Modal de previsualización — montado en document.body via portal */}
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} onDownload={onDownload} />}
    </div>
  );
}

ArchivosFase.propTypes = {
  projectId: PropTypes.string.isRequired,
  phaseId: PropTypes.string.isRequired,
  canEdit: PropTypes.bool,
  canToggleVisibility: PropTypes.bool,
  clientView: PropTypes.bool,
  currentUserUid: PropTypes.string,
};

function PreviewModal({ file, onClose, onDownload }) {
  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const isImage = file.contentType?.startsWith("image/");
  const isPDF   = file.contentType === "application/pdf";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.92)" }}>
      {/* Barra superior */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(0,0,0,0.5)", flexShrink: 0, gap: 12 }}>
        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>
          {file.fileName}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onDownload(file)}
            style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "6px 14px", background: "transparent", cursor: "pointer" }}
          >
            Descargar
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 28, lineHeight: 1, color: "white", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", display: "flex", alignItems: isImage ? "center" : "stretch", justifyContent: isImage ? "center" : "stretch", padding: isImage ? 16 : 0 }}>
        {isImage && (
          <img
            src={file.downloadURL}
            alt={file.fileName}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
          />
        )}
        {isPDF && (
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(file.downloadURL)}&embedded=true`}
            title={file.fileName}
            style={{ width: "100%", height: "100%", border: "none", background: "white", display: "block" }}
          />
        )}
      </div>

    </div>,
    document.body
  );
}

function isPreviewable(contentType) {
  if (!contentType) return false;
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}