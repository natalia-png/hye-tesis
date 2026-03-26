// src/pages/ProyectoDetalle.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import BtnReportePDF from "../components/BtnReportePDF";
import PropTypes from "prop-types";


import FasesProyecto from "../components/FasesProyecto.jsx";
import { DEFAULT_FASES, calcAvanceGlobal, cloneFases } from "../data/fases";

export default function ProyectoDetalle({
  canManageDocuments = false,
  clientView = false,
}) {
  const { id } = useParams();
  const nav = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const ref = doc(db, "projects", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("El proyecto no existe o fue eliminado.");
          setProject(null);
          return;
        }

        const data = snap.data() || {};

        const fasesFromDb = Array.isArray(data.fases)
          ? data.fases
          : Array.isArray(data.phases)
            ? data.phases
            : null;

        const fasesSafe =
          fasesFromDb && fasesFromDb.length > 0
            ? fasesFromDb
            : cloneFases(DEFAULT_FASES);

        const avanceReal = calcAvanceGlobal(fasesSafe);

        const adminNotes = data.adminNotes || "";
        setNotesValue(adminNotes);
        setProject({
          id: snap.id,
          code: data.code || snap.id,
          name: data.name || data.nombre || "Proyecto sin nombre",
          client: data.client || data.cliente || "Cliente sin nombre",
          status: data.status || data.estado || "Sin estado",

          progressReal: avanceReal,
          fases: fasesSafe,

          startDate: data.startDate || data.fechaInicio || null,
          endDate: data.endDate || data.fechaEntrega || null,

          type: data.type || data.tipo || null,
          location: data.location || data.ubicacion || null,
          leadArchitect: data.leadArchitect || data.arquitecto || null,
          engineer: data.engineer || data.ingeniero || null,
          lawyer: data.lawyer || data.abogado || null,
          budget: data.budget ?? data.presupuesto ?? null,
          description: data.description || data.descripcion || "",
          adminNotes: data.adminNotes || "",

          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        });
      } catch (e) {
        setError("No se pudo cargar la información del proyecto.");
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  const goBack = () => {
    nav(clientView ? "/mis-proyectos" : "/proyectos");
  };

  async function saveNotes() {
    setNotesSaving(true);
    try {
      await updateDoc(doc(db, "projects", id), { adminNotes: notesValue });
      setProject(p => ({ ...p, adminNotes: notesValue }));
      setEditingNotes(false);
    } catch {
      // silently ignore
    } finally {
      setNotesSaving(false);
    }
  }

  const canEditFases = canManageDocuments && !clientView;

  if (loading) {
    return (
      <section className="space-y-4">
        <HeaderDetalle onBack={goBack} />
        <p className="text-[13px] text-ink/60">Cargando proyecto…</p>
      </section>
    );
  }

  if (error || !project) {
    return (
      <section className="space-y-4">
        <HeaderDetalle onBack={goBack} />
        <p className="text-[13px] text-red-600">
          {error || "No se encontró el proyecto."}
        </p>
        <button className="btn-primary" onClick={goBack}>
          Volver a proyectos
        </button>
      </section>
    );
  }

  const {
    code,
    name,
    client,
    status,
    progressReal,
    fases,
    type,
    location,
    budget,
    startDate,
    endDate,
    createdAt,
    updatedAt,
  } = project;

  const lastUpdate = updatedAt || createdAt;

  return (
    <section className="space-y-4">
      <HeaderDetalle onBack={goBack} />

      {/* Cabecera del proyecto */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.18em] uppercase text-ink/50">
              Proyecto
            </p>
            <h1 className="text-[18px] font-semibold text-ink leading-snug">
              {name}
            </h1>
            <p className="text-[13px] text-ink/70 mt-1">
              Código <span className="font-medium">{code}</span> · Cliente{" "}
              <span className="font-medium">{client}</span>
            </p>
            <p className="text-[11px] text-ink/50 mt-1">
              Actualizado:{" "}
              <span className="font-medium">{timeAgoSmart(lastUpdate)}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center rounded-full bg-sand px-3 py-[4px] text-[11px] text-ink/80">
              {status}
            </span>

            {canManageDocuments && !clientView && (
              <button
                type="button"
                onClick={() => nav(`/proyectos/${id}/editar`)}
                className="text-[11px] text-ink/70 hover:text-ink underline"
              >
                Editar
              </button>
            )}
            {canManageDocuments && !clientView && (
              <button
                type="button"
                onClick={() => nav(`/proyectos/${id}/garantias`)}
                className="text-[11px] text-ink/70 hover:text-ink underline"
              >
                Garantías
              </button>
            )}
            <BtnReportePDF proyecto={project} isAdmin={!clientView} />
          </div>
        </div>

        {/* Barra de avance real global */}
        <div className="mt-1">
          <div className="flex justify-between text-[11px] text-ink/60 mb-1">
            <span>Avance real</span>
            <span>{progressReal}%</span>
          </div>
          <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
            <div
              className="h-full bg-ink"
              style={{ width: `${progressReal}%` }}
            />
          </div>
          <p className="text-[11px] text-ink/50 mt-1">
            Calculado a partir del avance por fases.
          </p>
        </div>
      </div>

      {/* Fases del proyecto */}
      <FasesProyecto
        projectId={id}
        fases={fases}
        clientView={clientView}
        canEdit={canEditFases}
        createdAt={createdAt}
        updatedAt={updatedAt}
      />

      {/* Info general */}
      <div className="grid gap-3">
        <div className="card space-y-2">
          <h2 className="text-[14px] font-semibold text-ink">
            Información general
          </h2>
          <InfoRow label="Tipo de proyecto" value={type} />
          <InfoRow label="Ubicación" value={location} />
          <InfoRow label="Presupuesto estimado" value={formatMoney(budget)} />
        </div>

        <div className="card space-y-2">
          <h2 className="text-[14px] font-semibold text-ink">
            Fechas clave (plan)
          </h2>
          <InfoRow label="Inicio" value={formatDate(startDate)} />
          <InfoRow label="Entrega estimada" value={formatDate(endDate)} />
          <DaysRemaining endDate={endDate} />
        </div>

        {!clientView && (
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-ink">
                Notas internas
              </h2>
              {canManageDocuments && !editingNotes && (
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="text-[12px] text-ink/50 hover:text-ink underline"
                >
                  Editar
                </button>
              )}
            </div>

            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  placeholder="Escribe notas internas del proyecto..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F4EE] border border-taupe/40
                             text-[13px] text-ink outline-none focus:ring-2 focus:ring-ink/10
                             focus:border-ink/40 resize-none transition"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveNotes}
                    disabled={notesSaving}
                    className="px-4 py-1.5 rounded-xl bg-ink text-white text-[12px]
                               disabled:opacity-60 hover:brightness-110 transition"
                  >
                    {notesSaving ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingNotes(false); setNotesValue(project.adminNotes || ""); }}
                    className="px-4 py-1.5 rounded-xl text-[12px] text-ink/60 hover:text-ink transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink/70 whitespace-pre-wrap">
                {project.adminNotes || (
                  <span className="italic text-ink/40">Sin notas internas aún.</span>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── UI helpers ─── */

function HeaderDetalle({ onBack }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <button
        type="button"
        onClick={onBack}
        className="text-[12px] text-ink/70 hover:text-ink"
      >
        ‹ Volver a proyectos
      </button>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-ink/60">{label}</span>
      <span className="text-ink font-medium text-right">{value || "—"}</span>
    </div>
  );
}

/* ─── data helpers ─── */

function formatDate(value) {
  if (!value) return "—";
  if (value?.seconds)
    return new Date(value.seconds * 1000).toLocaleDateString("es-CO");
  try {
    return new Date(value).toLocaleDateString("es-CO");
  } catch {
    return String(value);
  }
}

function formatMoney(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return value.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }
  const n = Number(String(value).replaceAll(/[^\d]/g, ""));
  if (Number.isFinite(n) && n > 0) {
    return n.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }
  return String(value);
}

function DaysRemaining({ endDate }) {
  if (!endDate) return null;
  const end = endDate?.seconds ? new Date(endDate.seconds * 1000) : new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;

  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff > 0) {
    return (
      <div className="flex justify-between gap-4 text-[13px]">
        <span className="text-ink/60">Días restantes</span>
        <span className="font-medium text-green-700">{diff} días</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-ink/60">Días de retraso</span>
      <span className="font-medium text-red-600">{Math.abs(diff)} días</span>
    </div>
  );
}

function timeAgoSmart(value) {
  if (!value) return "—";
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "hace unos segundos";
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

ProyectoDetalle.propTypes = {
  canManageDocuments: PropTypes.bool,
  clientView: PropTypes.bool,
};

HeaderDetalle.propTypes = {
  onBack: PropTypes.func,
};

InfoRow.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any,
};

DaysRemaining.propTypes = {
  endDate: PropTypes.any,
};