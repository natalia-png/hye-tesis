// src/components/NotasFase.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // ✅ evita el “mensaje rojo fantasma”
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

        // ✅ ya hubo respuesta válida del listener (aunque sea lista vacía)
        hadSuccessRef.current = true;
        setError("");
      },
      (e) => {
        console.error(e);

        // ✅ si ya cargó una vez, NO ensuciar UI con rojo
        if (hadSuccessRef.current) return;

        setError("No se pudieron cargar las notas.");
      }
    );

    return () => unsub();
  }, [notasRef]);

  const lastUpdate = items?.[0]?.createdAt || null;

  const onAdd = async () => {
    if (!canEdit) return;

    const t = text.trim();
    if (!t) return;

    if (!notasRef) {
      setError("No se encontró la fase para guardar la nota (phaseId vacío).");
      return;
    }

    setSaving(true);
    setError("");
    setOk("");

    try {
      await addDoc(notasRef, {
        text: t,
        createdAt: serverTimestamp(),
        createdBy: "admin",
        visibleToClient: true,
      });

      setText("");
      setOk("Nota guardada.");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar la nota. Revisa permisos o conexión.");
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

      {/* ✅ Solo mostrar error si NO hay nada cargado */}
      {error && items.length === 0 && (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      )}

      {ok && <p className="mt-2 text-[12px] text-ink/70">{ok}</p>}

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

      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-[12px] text-ink/60">
            Aún no hay notas para esta fase.
          </p>
        ) : (
          items.map((n) => (
            <div key={n.id} className="rounded-xl border border-sand bg-white p-3">
              <p className="text-[13px] text-ink/80 whitespace-pre-wrap">{n.text}</p>
              <p className="mt-2 text-[10px] text-ink/50">
                {timeAgoSmart(n.createdAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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

  const days = Math.floor(h / 24);
  return `hace ${days} d`;
}
