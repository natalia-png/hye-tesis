// src/pages/ProyectoNuevo.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cloneFases, DEFAULT_FASES } from "../data/fases";
import { useAuth } from "../app/useAuth";
import { findUserByEmail } from "../lib/firestore";

const INITIAL_FORM = {
  code: "",
  name: "",
  client: "",
  clientEmail: "", // ✅ Luisa usa esto (amigable)
  type: "",
  location: "",
  budget: "",
  startDate: "",
  endDate: "",
  description: "",
};

export default function ProyectoNuevo() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
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
      // ✅ Resolver clientId por email (si se ingresó)
      let clientId = null;
      const email = form.clientEmail.trim().toLowerCase();

      if (email) {
        const found = await findUserByEmail(email);
        if (!found) {
          setError(
            "No encontramos un usuario con ese email. Pídele al cliente que se registre/inicie sesión primero."
          );
          setSaving(false);
          return;
        }
        if ((found.role || "").toLowerCase() !== "cliente") {
          setError("Ese email existe, pero no corresponde a un usuario cliente.");
          setSaving(false);
          return;
        }
        clientId = found.uid;
      }

      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        client: form.client.trim(),

        // ✅ amarre seguro
        clientId,
        clientEmail: email || null,

        type: form.type.trim() || null,
        location: form.location.trim() || null,
        budget: form.budget ? Number(form.budget) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        description: form.description.trim() || "",

        status: "Planificado",
        fases: cloneFases(DEFAULT_FASES),
        progress: 0,

        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "projects"), payload);
      nav(`/proyectos/${docRef.id}`);
    } catch (e) {
      console.error("Error creando proyecto:", e);
      setError("No se pudo crear el proyecto. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => nav("/proyectos");

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={goBack}
          className="text-[12px] text-ink/70 hover:text-ink inline-flex items-center"
        >
          ‹ Volver a proyectos
        </button>
      </div>

      <div className="card space-y-3">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-ink/50">
            Nuevo proyecto
          </p>
          <h1 className="text-[18px] font-semibold text-ink leading-snug">
            Registrar proyecto para H&amp;E
          </h1>
          <p className="text-[12px] text-ink/65 mt-1">
            Luisa puede asignar el proyecto a un cliente usando su email. El
            sistema enlaza internamente al UID para que el cliente vea el
            proyecto en “Mis proyectos” sin exponer la base.
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
                placeholder="ARQ-004"
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
                placeholder="Casa Nogal II"
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
              placeholder="Familia Pérez"
              className="input w-full text-[13px]"
              required
            />
          </div>

          {/* ✅ Amigable: asignación por email */}
          <div>
            <label className="block text-[11px] text-ink/60 mb-1">
              Email del cliente (para asignar “Mis proyectos”)
            </label>
            <input
              name="clientEmail"
              value={form.clientEmail}
              onChange={handleChange}
              placeholder="cliente@correo.com"
              className="input w-full text-[13px]"
              type="email"
            />
            <p className="text-[11px] text-ink/50 mt-1">
              El cliente debe haberse registrado antes. Si lo dejas vacío, el
              proyecto se crea igual pero no aparecerá en “Mis proyectos”.
            </p>
          </div>

          {/* resto igual */}
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
                placeholder="Bogotá, Colombia"
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
              type="number"
              min="0"
              step="1000000"
              value={form.budget}
              onChange={handleChange}
              placeholder="250000000"
              className="input w-full text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">
                Fecha de inicio
              </label>
              <input
                name="startDate"
                type="date"
                value={form.startDate}
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
                value={form.endDate}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-ink/60 mb-1">
              Descripción / alcance inicial
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              maxLength={800}
              placeholder="Breve descripción del encargo..."
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
              {saving ? "Guardando…" : "Crear proyecto"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
