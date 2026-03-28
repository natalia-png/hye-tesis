// src/components/NotasFase.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function NotasFase({
  projectId,
  phaseId,
  canEdit = false,
  clientView = false,
}) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);   // id de nota borrándose
  const [editing, setEditing] = useState(null);     // { id, text } de nota editándose
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const hadSuccessRef = useRef(false);

  const notasRef = useMemo(() => {
    if (!projectId || !phaseId) return null;
    return collection(db, "projects", projectId, "fases", phaseId, "notas");
  }, [projectId, phaseId]);

  useEffect(() => {
    setItems([]);
    setOk("");
    setError("");
    hadSuccessRef.current = false;

    if (!notasRef) return;

    const qs = query(notasRef, orderBy("createdAt", "desc"), limit(30));

    const unsub = onSnapshot(
      qs,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(list);
        hadSuccessRef.current = true;
        setError("");
      },
      (e) => {
        if (hadSuccessRef.current) return;
        setError("No se pudieron cargar las notas.");
      }
    );

    return () => { try { unsub(); } catch (e) { console.error(e); } };
  }, [notasRef]);

  const lastUpdate = items?.[0]?.createdAt || null;

  const flash = (msg) => {
    setOk(msg);
    setTimeout(() => setOk(""), 2000);
  };

  // ── Agregar nota ──────────────────────────────────────────────
  const onAdd = async () => {
    if (!canEdit) return;
    const t = text.trim();
    if (!t) return;
    if (!notasRef) {
      setError("No se encontró la fase para guardar la nota.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addDoc(notasRef, {
        text: t,
        createdAt: serverTimestamp(),
        createdBy: "admin",
        visibleToClient: true,
      });
      setText("");
      flash("Nota guardada.");
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  };

  // ── Eliminar nota ─────────────────────────────────────────────
  const onDelete = async (nota) => {
    if (!canEdit || !notasRef) return;
    const sure = confirm("¿Eliminar esta nota? Esta acción no se puede deshacer.");
    if (!sure) return;

    setDeleting(nota.id);
    setError("");

    try {
      await deleteDoc(doc(notasRef, nota.id));
      flash("Nota eliminada.");
    } catch (e) {
      console.error(e);
      setError("No se pudo eliminar la nota.");
    } finally {
      setDeleting(null);
    }
  };

  // ── Editar nota ───────────────────────────────────────────────
  const startEdit = (nota) => {
    setEditing({ id: nota.id, text: nota.text });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!canEdit || !notasRef || !editing) return;
    const t = editing.text.trim();
    if (!t) return;

    setSaving(true);
    setError("");

    try {
      await updateDoc(doc(notasRef, editing.id), {
        text: t,
        editedAt: serverTimestamp(),
      });
      setEditing(null);
      flash("Nota actualizada.");
    } catch (e) {
      console.error(e);
      setError("No se pudo actualizar la nota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-sand bg-white/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-ink">Notas</p>
          <p className="text-[11px] text-ink/60">
            {clientView
              ? "Actualizaciones y comentarios asociados a esta fase."
              : "Registra avances o decisiones. El cliente verá estas notas."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-ink/50">Última actualización</p>
          <p className="text-[11px] text-ink/70 font-medium">
            {timeAgoSmart(lastUpdate)}
          </p>
        </div>
      </div>

      {error && items.length === 0 && (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      )}
      {ok && <p className="mt-2 text-[12px] text-ink/70">{ok}</p>}

      {/* Formulario nueva nota */}
      {canEdit && (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Escribe una nota breve (máx. 500 caracteres)…"
            className="input w-full text-[13px] resize-none"
            disabled={saving}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary text-[13px]"
              onClick={onAdd}
              disabled={saving || !text.trim()}
            >
              {saving ? "Guardando…" : "Guardar nota"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de notas */}
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-[12px] text-ink/60">Aún no hay notas para esta fase.</p>
        ) : (
          items.map((n) => (
            <div key={n.id} className="rounded-xl border border-sand bg-white p-3">

              {/* ── Modo edición ── */}
              {editing?.id === n.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editing.text}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, text: e.target.value }))
                    }
                    rows={3}
                    maxLength={500}
                    className="input w-full text-[13px] resize-none"
                    disabled={saving}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn-outline text-[12px]"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-[12px]"
                      onClick={saveEdit}
                      disabled={saving || !editing.text.trim()}
                    >
                      {saving ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Modo lectura ── */
                <>
                  <p className="text-[13px] text-ink/80 whitespace-pre-wrap">{n.text}</p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-ink/50">
                      {timeAgoSmart(n.createdAt)}
                      {n.editedAt && (
                        <span className="ml-1 text-ink/40">(editada)</span>
                      )}
                    </p>

                    {/* Botones solo admin */}
                    {canEdit && !clientView && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(n)}
                          disabled={!!deleting}
                          className="text-[11px] text-ink/50 hover:text-ink transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(n)}
                          disabled={deleting === n.id}
                          className="text-[11px] text-ink/40 hover:text-red-500 transition-colors"
                        >
                          {deleting === n.id ? "Eliminando…" : "Eliminar"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

NotasFase.propTypes = {
  projectId: PropTypes.string.isRequired,
  phaseId: PropTypes.string.isRequired,
  canEdit: PropTypes.bool,
  clientView: PropTypes.bool,
};

function timeAgoSmart(value) {
  if (!value) return "—";
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);

  if (s < 10) return "hace unos segundos";
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}