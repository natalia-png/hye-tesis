// src/pages/ProyectoDetalle.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import DocumentosProyecto from "../components/DocumentosProyecto.jsx";

export default function ProyectoDetalle({
  canManageDocuments = false, // viene desde App.jsx según la ruta
  clientView = false,         // true si es vista de cliente
}) {
  const { id } = useParams();
  const nav = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        const data = snap.data();

        setProject({
          id: snap.id,
          code: data.code || snap.id,
          name: data.name || data.nombre || "Proyecto sin nombre",
          client: data.client || data.cliente || "Cliente sin nombre",
          status: data.status || data.estado || "Sin estado",
          progress:
            typeof data.progress === "number"
              ? data.progress
              : typeof data.avance === "number"
              ? data.avance
              : 0,
          type: data.type || data.tipo || null,
          location: data.location || data.ubicacion || null,
          leadArchitect: data.leadArchitect || data.arquitecto || null,
          engineer: data.engineer || data.ingeniero || null,
          lawyer: data.lawyer || data.abogado || null,
          budget: data.budget || data.presupuesto || null,
          startDate: data.startDate || data.fechaInicio || null,
          endDate: data.endDate || data.fechaEntrega || null,
          description: data.description || data.descripcion || "",
        });
      } catch (e) {
        console.error("Error cargando proyecto:", e);
        setError("No se pudo cargar la información del proyecto.");
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  const goBack = () => {
    if (clientView) {
      nav("/mis-proyectos");
    } else {
      nav("/proyectos");
    }
  };

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
    progress,
    type,
    location,
    leadArchitect,
    engineer,
    lawyer,
    budget,
    startDate,
    endDate,
    description,
  } = project;

  return (
    <section className="space-y-4">
      <HeaderDetalle onBack={goBack} />

      {/* Cabecera del proyecto */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
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
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center rounded-full bg-sand px-3 py-[4px] text-[11px] text-ink/80">
              {status}
            </span>

            {/* Solo equipo interno puede editar */}
            {canManageDocuments && !clientView && (
              <button
                type="button"
                onClick={() => nav(`/proyectos/${id}/editar`)}
                className="text-[11px] text-ink/70 hover:text-ink underline"
              >
                Editar
              </button>
            )}
          </div>
        </div>

        <p className="text-[12px] text-ink/65">
          Esta ficha resume la información clave del proyecto para la dirección
          de la firma: alcance, responsables, fechas y avance general. A partir
          de aquí se coordinan las decisiones con ingeniería, jurídica y el
          cliente.
        </p>

        {/* Avance */}
        <div className="mt-1">
          <div className="flex justify-between text-[11px] text-ink/60 mb-1">
            <span>Avance global</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
            <div className="h-full bg-ink" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Información general + equipo + fechas + notas */}
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
            Equipo responsable
          </h2>
          <InfoRow
            label="Arquitecta líder"
            value={leadArchitect || "Luisa H&E"}
          />
          <InfoRow label="Ingeniería" value={engineer} />
          <InfoRow label="Jurídica" value={lawyer} />
        </div>

        <div className="card space-y-2">
          <h2 className="text-[14px] font-semibold text-ink">Fechas clave</h2>
          <InfoRow label="Inicio" value={formatDate(startDate)} />
          <InfoRow label="Entrega estimada" value={formatDate(endDate)} />
        </div>

        <div className="card space-y-2">
          <h2 className="text-[14px] font-semibold text-ink">
            Alcance y notas
          </h2>
          <p className="text-[13px] text-ink/70">
            {description
              ? description
              : "Aún no se ha registrado una descripción detallada para este proyecto. Desde aquí podrás documentar el alcance arquitectónico, fases de trabajo y acuerdos clave con el cliente."}
          </p>
        </div>
      </div>

      {/* Documentos del proyecto */}
      <DocumentosProyecto projectId={id} canManage={canManageDocuments} />
    </section>
  );
}

/* ------------ Componentes de apoyo ------------------ */

function HeaderDetalle({ onBack }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <button
        type="button"
        onClick={onBack}
        className="text-[12px] text-ink/70 hover:text-ink inline-flex items-center"
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
      <span className="text-ink font-medium text-right">
        {value || "—"}
      </span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  if (value?.seconds) {
    return new Date(value.seconds * 1000).toLocaleDateString("es-ES");
  }
  try {
    return new Date(value).toLocaleDateString("es-ES");
  } catch {
    return String(value);
  }
}

function formatMoney(value) {
  if (value == null) return "—";
  if (typeof value === "number") {
    return value.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }
  return value;
}
