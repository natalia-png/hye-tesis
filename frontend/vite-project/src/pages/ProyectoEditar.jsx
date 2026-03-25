// src/pages/ProyectoEditar.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { normalizeFases } from "../data/fases";

const EMPTY_FORM = {
  code: "",
  name: "",
  client: "",
  type: "",
  location: "",
  budget: "",
  startDate: "",
  endDate: "",
  description: "",
  status: "Planificado",
};

export default function ProyectoEditar() {
  const { id } = useParams();
  const nav = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fases, setFases] = useState([]); // array de fases con fechas planeadas
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          return;
        }

        const data = snap.data() || {};

        setForm({
          code: data.code || "",
          name: data.name || data.nombre || "",
          client: data.client || data.cliente || "",
          type: data.type || data.tipo || "",
          location: data.location || data.ubicacion || "",
          budget:
            typeof data.budget === "number"
              ? String(data.budget)
              : data.budget || "",
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          description: data.description || data.descripcion || "",
          status: data.status || data.estado || "Planificado",
        });

        // Cargar fases con sus fechas planeadas
        const fasesRaw = Array.isArray(data.fases) ? data.fases : [];
        setFases(normalizeFases(fasesRaw));
      } catch (e) {
        setError("No se pudieron cargar los datos del proyecto.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const budgetPretty = useMemo(() => {
    if (!form.budget) return "";
    const n = Number(form.budget.replace(/[^\d]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return "";
    return n.toLocaleString("es-CO");
  }, [form.budget]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: name === "budget" ? value.replace(/[^\d]/g, "") : value,
    }));
  };

  // Actualizar fecha planeada de una fase
  const handleFechaFase = (faseId, campo, valor) => {
    setFases((prev) =>
      prev.map((f) =>
        f.id === faseId ? { ...f, [campo]: valor || null } : f
      )
    );
  };

  const validateDates = () => {
    if (!form.startDate || !form.endDate) return true;
    return new Date(form.startDate) <= new Date(form.endDate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.client.trim()) {
      setError("El nombre del proyecto y el cliente son obligatorios.");
      return;
    }

    if (!validateDates()) {
      setError("La fecha de inicio no puede ser posterior a la fecha de entrega estimada.");
      return;
    }

    // Validar que las fechas de fases sean coherentes
    for (const f of fases) {
      if (f.fechaInicioPlaneada && f.fechaFinPlaneada) {
        if (new Date(f.fechaInicioPlaneada) > new Date(f.fechaFinPlaneada)) {
          setError(`En la fase "${f.nombre}": el inicio planeado no puede ser posterior al fin.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const ref = doc(db, "projects", id);

      await updateDoc(ref, {
        code: form.code.trim() || null,
        name: form.name.trim(),
        client: form.client.trim(),
        type: form.type.trim() || null,
        location: form.location.trim() || null,
        budget: form.budget ? Number(form.budget) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        description: form.description.trim() || "",
        status: form.status || "Planificado",
        fases, // ✅ guarda fases con fechas planeadas actualizadas
        updatedAt: serverTimestamp(),
      });

      nav(`/proyectos/${id}`);
    } catch (e2) {
      setError("No se pudo actualizar el proyecto. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => nav(`/proyectos/${id}`);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button type="button" onClick={goBack} className="text-[12px] text-ink/70 hover:text-ink">
            ‹ Volver
          </button>
        </div>
        <p className="text-[13px] text-ink/60">Cargando información…</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={goBack} className="text-[12px] text-ink/70 hover:text-ink">
          ‹ Volver al detalle
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Información general ── */}
        <div className="card space-y-3">
          <div>
            <p className="text-[11px] tracking-[0.18em] uppercase text-ink/50">
              Editar proyecto
            </p>
            <h1 className="text-[18px] font-semibold text-ink leading-snug">
              Información general
            </h1>
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-[11px] text-ink/60 mb-1">Código interno</label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                className="input w-full text-[13px]"
                placeholder="ARQ-001"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-ink/60 mb-1">Nombre del proyecto *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="input w-full text-[13px]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">Cliente / razón social *</label>
            <input
              name="client"
              value={form.client}
              onChange={handleChange}
              className="input w-full text-[13px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">Tipo de proyecto</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="input w-full text-[13px] pr-8"
              >
                <option value="">Seleccionar…</option>
                <option value="Vivienda unifamiliar">Vivienda unifamiliar</option>
                <option value="Edificio de vivienda">Edificio de vivienda</option>
                <option value="Oficinas">Oficinas</option>
                <option value="Comercial">Comercial</option>
                <option value="Institucional">Institucional</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">Ubicación</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">Presupuesto estimado (COP)</label>
            <input
              name="budget"
              type="text"
              inputMode="numeric"
              value={form.budget}
              onChange={handleChange}
              className="input w-full text-[13px]"
              placeholder="Ej: 800000000"
            />
            {budgetPretty && (
              <p className="text-[11px] text-ink/50 mt-1">
                Formato: <span className="font-medium">{budgetPretty}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">Estado</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="input w-full text-[13px] pr-8"
            >
              <option value="Planificado">Planificado</option>
              <option value="En diseño">En diseño</option>
              <option value="En ejecución">En ejecución</option>
              <option value="En revisión">En revisión</option>
              <option value="En entrega">En entrega</option>
              <option value="Finalizado">Finalizado</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">Descripción / notas</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              maxLength={800}
              className="input w-full text-[13px] resize-none"
              placeholder="Notas relevantes del alcance, decisiones, condiciones del cliente…"
            />
          </div>
        </div>

        {/* ── Cronograma general ── */}
        <div className="card space-y-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Cronograma general</h2>
            <p className="text-[11px] text-ink/60 mt-0.5">
              Fechas globales del proyecto. Se usan para calcular el avance esperado general.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">Inicio del proyecto</label>
              <input
                name="startDate"
                type="date"
                value={form.startDate || ""}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">Entrega estimada</label>
              <input
                name="endDate"
                type="date"
                value={form.endDate || ""}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
          </div>
        </div>

        {/* ── Cronograma por fases ── */}
        <div className="card space-y-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Cronograma por fases</h2>
            <p className="text-[11px] text-ink/60 mt-0.5">
              Define cuándo debería iniciar y terminar cada fase. Esto permite comparar
              el plan contra el avance real en el detalle del proyecto.
            </p>
          </div>

          <div className="grid gap-3">
            {fases.map((f) => {
              const tieneFechas = f.fechaInicioPlaneada && f.fechaFinPlaneada;

              return (
                <div
                  key={f.id}
                  className={`rounded-xl border p-3 space-y-2 ${
                    tieneFechas ? "border-sand bg-ivory/60" : "border-dashed border-taupe/40 bg-white"
                  }`}
                >
                  {/* Nombre + estado */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink">{f.nombre}</p>
                    {tieneFechas ? (
                      <span className="text-[10px] text-ink/50 bg-sand px-2 py-0.5 rounded-full">
                        ✓ con fechas
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        sin fechas plan
                      </span>
                    )}
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-ink/55 mb-1">
                        Inicio planeado
                      </label>
                      <input
                        type="date"
                        value={f.fechaInicioPlaneada || ""}
                        onChange={(e) =>
                          handleFechaFase(f.id, "fechaInicioPlaneada", e.target.value)
                        }
                        className="input w-full text-[12px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-ink/55 mb-1">
                        Fin planeado
                      </label>
                      <input
                        type="date"
                        value={f.fechaFinPlaneada || ""}
                        onChange={(e) =>
                          handleFechaFase(f.id, "fechaFinPlaneada", e.target.value)
                        }
                        className="input w-full text-[12px]"
                      />
                    </div>
                  </div>

                  {/* Avance real actual (solo lectura, referencia) */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-sand rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ink rounded-full"
                        style={{ width: `${f.porcentaje || 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-ink/50 flex-shrink-0">
                      {f.porcentaje || 0}% real actual
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-ink/45">
            💡 No es obligatorio llenar todas las fases. El comparativo mostrará solo
            las que tengan fechas definidas.
          </p>
        </div>

        {/* ── Botones ── */}
        <div className="flex justify-end gap-2 pb-4">
          <button
            type="button"
            onClick={goBack}
            className="btn-outline text-[13px]"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-[13px]"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>

      </form>
    </section>
  );
}