// src/pages/ProyectoEditar.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

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
  status: "",
};

export default function ProyectoEditar() {
  const { id } = useParams();
  const nav = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
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
      } catch (e) {
        console.error(e);
        setError("No se pudieron cargar los datos del proyecto.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: name === "budget" ? value.replace(/[^\d]/g, "") : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.client.trim()) {
      setError("El nombre del proyecto y el cliente son obligatorios.");
      return;
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

        // ✅ No tocamos progress aquí: lo controla FasesProyecto
        updatedAt: serverTimestamp(),
      });

      nav(`/proyectos/${id}`);
    } catch (e) {
      console.error("Error actualizando proyecto:", e);
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
          <button
            type="button"
            onClick={goBack}
            className="text-[12px] text-ink/70 hover:text-ink inline-flex items-center"
          >
            ‹ Volver
          </button>
        </div>
        <p className="text-[13px] text-ink/60">Cargando información…</p>
      </section>
    );
  }

  if (error && !form.name) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={goBack}
            className="text-[12px] text-ink/70 hover:text-ink inline-flex items-center"
          >
            ‹ Volver
          </button>
        </div>
        <p className="text-[13px] text-red-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={goBack}
          className="text-[12px] text-ink/70 hover:text-ink inline-flex items-center"
        >
          ‹ Volver al detalle
        </button>
      </div>

      <div className="card space-y-3">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-ink/50">
            Editar proyecto
          </p>
          <h1 className="text-[18px] font-semibold text-ink leading-snug">
            Actualizar información
          </h1>
          <p className="text-[12px] text-ink/65 mt-1">
            Ajusta los datos generales del proyecto. El avance (%) se gestiona
            desde “Fases del proyecto” para mantener trazabilidad y coherencia.
          </p>
        </div>

        {error && <p className="text-[12px] text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-[11px] text-ink/60 mb-1">
                Código interno
              </label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-ink/60 mb-1">
                Nombre del proyecto *
              </label>
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
            <label className="block text-[11px] text-ink/60 mb-1">
              Cliente / razón social *
            </label>
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
              <label className="block text-[11px] text-ink/60 mb-1">
                Tipo de proyecto
              </label>
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
              <label className="block text-[11px] text-ink/60 mb-1">
                Ubicación
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">
              Presupuesto estimado (COP)
            </label>
            <input
              name="budget"
              type="text"
              inputMode="numeric"
              value={form.budget}
              onChange={handleChange}
              className="input w-full text-[13px]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">
              Estado
            </label>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">
                Fecha de inicio
              </label>
              <input
                name="startDate"
                type="date"
                value={form.startDate || ""}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">
                Entrega estimada
              </label>
              <input
                name="endDate"
                type="date"
                value={form.endDate || ""}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">
              Descripción / notas
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              maxLength={800}
              className="input w-full text-[13px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
      </div>
    </section>
  );
}
