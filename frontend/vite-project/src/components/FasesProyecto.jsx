// src/components/FasesProyecto.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import NotasFase from "./NotasFase.jsx";
import ArchivosFase from "./ArchivosFase.jsx";
import { calcAvanceGlobal, clampInt, labelEstado, normalizeFases } from "../data/fases";

export default function FasesProyecto({
  projectId,
  fases = [],
  clientView = false,
  canEdit = false,     // 👈 viene desde ProyectoDetalle (admin true, cliente false)
  updatedAt = null,    // 👈 del doc projects
  createdAt = null,    // 👈 del doc projects
}) {
  const safeFases = useMemo(() => normalizeFases(fases), [fases]);

  // local editable state (para no guardar en cada movimiento)
  const [localFases, setLocalFases] = useState(safeFases);
  const initialRef = useRef(safeFases);

  // acordeón: abre 1 fase
  const [openId, setOpenId] = useState(safeFases?.[0]?.id || null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // sincroniza si cambian las fases desde el servidor (por ejemplo al recargar)
  useEffect(() => {
    setLocalFases(safeFases);
    initialRef.current = safeFases;
    if (!openId && safeFases?.[0]?.id) setOpenId(safeFases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeFases]);

  const canEditHere = !!canEdit && !clientView;

  const avanceGlobal = useMemo(() => calcAvanceGlobal(localFases), [localFases]);
  const completed = localFases.filter((f) => f.estado === "completada").length;

  const dirty = useMemo(() => {
    const a = JSON.stringify(initialRef.current?.map(pickComparable));
    const b = JSON.stringify(localFases?.map(pickComparable));
    return a !== b;
  }, [localFases]);

  const lastUpdate = updatedAt || createdAt;

  const setPct = (phaseId, value) => {
    const pct = clampInt(value, 0, 100);

    setLocalFases((prev) =>
      prev.map((f) => {
        if (f.id !== phaseId) return f;

        const estado =
          pct >= 100 ? "completada" : pct > 0 ? "en_curso" : "pendiente";

        return { ...f, porcentaje: pct, estado };
      })
    );
  };

  const reset = () => {
    setLocalFases(initialRef.current);
    setError("");
    setToast("Cambios restablecidos.");
    setTimeout(() => setToast(""), 2500);
  };

  const saveAll = async () => {
    if (!canEditHere) return;
    if (!projectId) {
      setError("No se encontró el ID del proyecto para guardar cambios.");
      return;
    }
    if (!dirty) return;

    setSaving(true);
    setError("");

    try {
      const progress = calcAvanceGlobal(localFases);

      await updateDoc(doc(db, "projects", projectId), {
        fases: localFases,
        progress,              // compat + reportable
        updatedAt: serverTimestamp(),
      });

      // ahora lo local se vuelve “baseline”
      initialRef.current = localFases;

      setToast("✅ Cambios guardados.");
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      console.error("Error guardando fases:", e);
      setError("No se pudieron guardar los cambios. Revisa permisos o conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Fases del proyecto</h2>
          <p className="text-[11px] text-ink/60">
            {clientView
              ? "Seguimiento por etapas. Las notas y avances se actualizan por el equipo de H&E."
              : "Ajusta el avance por fase. Guarda cuando termines para mantener consistencia."}
          </p>

          <p className="text-[11px] text-ink/50 mt-1">
            Actualizado:{" "}
            <span className="font-medium">{timeAgoSmart(lastUpdate)}</span>
          </p>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-ink/60">Avance global</p>
          <p className="text-[16px] font-semibold text-ink leading-tight">{avanceGlobal}%</p>
          <p className="text-[11px] text-ink/50">
            {completed}/{localFases.length} completadas
          </p>
        </div>
      </div>

      {/* actions admin */}
      {canEditHere && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-ink/60">
            {dirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-outline text-[12px]"
              onClick={reset}
              disabled={saving || !dirty}
            >
              Restablecer
            </button>

            <button
              type="button"
              className="btn-primary text-[12px]"
              onClick={saveAll}
              disabled={saving || !dirty}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {toast && <p className="text-[12px] text-ink/70">{toast}</p>}
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {/* Acordeón */}
      <div className="grid gap-2">
        {localFases.map((f) => {
          const pct = clampInt(f.porcentaje, 0, 100);
          const isOpen = openId === f.id;

          return (
            <div
              key={f.id}
              className="rounded-2xl border border-sand bg-white/80 overflow-hidden"
            >
              {/* Header card (siempre visible) */}
              <button
                type="button"
                onClick={() => setOpenId((cur) => (cur === f.id ? null : f.id))}
                className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">
                    {f.nombre}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <EstadoChip estado={f.estado} />
                    <span className="text-[11px] text-ink/60">{pct}%</span>
                    <span className="text-[11px] text-ink/40">· Peso {f.peso}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{pct}%</span>
                  <span className="text-[12px] text-ink/50">
                    {isOpen ? "▴" : "▾"}
                  </span>
                </div>
              </button>

              {/* Body (solo si está abierta) */}
              {isOpen && (
                <div className="px-3 pb-3">
                  {/* Barra visual única */}
                  <div className="mt-2">
                    <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Slider (solo admin) */}
                  {canEditHere ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-ink/60 mb-1">
                        <span>Ajustar avance</span>
                        <span>{pct}%</span>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={pct}
                        onChange={(e) => setPct(f.id, e.target.value)}
                        className="w-full accent-ink"
                      />

                      <p className="text-[10px] text-ink/50 mt-1">
                        Incrementos de 5% para consistencia en reportes.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-ink/50">
                      Esta fase es informativa. El avance lo actualiza el equipo de H&amp;E.
                    </p>
                  )}

                  {/* Notas por fase (admin crea, cliente lee) */}
                  <NotasFase
                    projectId={projectId}
                    phaseId={f.id}
                    canEdit={canEditHere}
                    clientView={clientView}
                  />
                  <ArchivosFase
                    projectId={projectId}
                    phaseId={f.id}
                    canEdit={canEditHere}
                    clientView={clientView}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {clientView && (
        <p className="text-[11px] text-ink/50">
          Nota: la información se actualiza por el equipo de H&amp;E. El cliente puede ver avances y notas por fase.
        </p>
      )}
    </div>
  );
}

function EstadoChip({ estado }) {
  const label = labelEstado(estado);

  const cls =
    estado === "completada"
      ? "bg-ivory border-taupe/30 text-ink"
      : estado === "en_curso"
      ? "bg-sand border-taupe/30 text-ink"
      : "bg-white border-sand text-ink/80";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] ${cls}`}>
      {label}
    </span>
  );
}

function pickComparable(f) {
  return {
    id: f?.id,
    porcentaje: clampInt(f?.porcentaje, 0, 100),
    estado: f?.estado,
    peso: f?.peso,
  };
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
