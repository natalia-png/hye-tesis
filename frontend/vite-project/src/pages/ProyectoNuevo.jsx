// src/pages/ProyectoNuevo.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getAuth } from "firebase/auth";
import { cloneFases, DEFAULT_FASES } from "../data/fases";
import { useAuth } from "../app/useAuth";
import { findUserByEmail } from "../lib/firestore";

const FUNCTIONS_URL = "https://us-central1-hye-tesis.cloudfunctions.net";

async function crearClienteNuevo(name, email) {
  const token = await getAuth().currentUser.getIdToken();
  const res = await fetch(`${FUNCTIONS_URL}/crearCliente`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ name, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al crear el cliente");
  return data.uid;
}

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
      // Resolver clientId por email — crea la cuenta si no existe
      let clientId = null;
      const email = form.clientEmail.trim().toLowerCase();

      if (email) {
        const found = await findUserByEmail(email);

        if (found) {
          // Ya existe — verificar que sea cliente
          if ((found.role || "").toLowerCase() !== "cliente") {
            setError("Ese email ya está registrado pero no es un usuario cliente.");
            setSaving(false);
            return;
          }
          clientId = found.uid;
        } else {
          // No existe — crear cuenta vía Cloud Function (Admin SDK + email Nodemailer)
          try {
            clientId = await crearClienteNuevo(form.client.trim(), email);
          } catch (createErr) {
            setError("No se pudo crear la cuenta del cliente: " + createErr.message);
            setSaving(false);
            return;
          }
        }
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
      console.error(e);
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
            proyecto en "Mis proyectos" sin exponer la base.
          </p>
        </div>

        {error && <p className="text-[12px] text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label htmlFor="nuevo-code" className="block text-[11px] text-ink/60 mb-1">
                Código interno
              </label>
              <input
                id="nuevo-code"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="ARQ-004"
                className="input w-full text-[13px]"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="nuevo-name" className="block text-[11px] text-ink/60 mb-1">
                Nombre del proyecto *
              </label>
              <input
                id="nuevo-name"
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
            <label htmlFor="nuevo-client" className="block text-[11px] text-ink/60 mb-1">
              Cliente / razón social *
            </label>
            <input
              id="nuevo-client"
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
            <label htmlFor="nuevo-clientEmail" className="block text-[11px] text-ink/60 mb-1">
              Email del cliente (para asignar "Mis proyectos")
            </label>
            <input
              id="nuevo-clientEmail"
              name="clientEmail"
              value={form.clientEmail}
              onChange={handleChange}
              placeholder="cliente@correo.com"
              className="input w-full text-[13px]"
              type="email"
            />
            <p className="text-[11px] text-ink/50 mt-1">
              El cliente debe haberse registrado antes. Si lo dejas vacío, el
              proyecto se crea igual pero no aparecerá en "Mis proyectos".
            </p>
          </div>

          {/* resto igual */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="nuevo-type" className="block text-[11px] text-ink/60 mb-1">
                Tipo de proyecto
              </label>
              <select
                id="nuevo-type"
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
              <label htmlFor="nuevo-location" className="block text-[11px] text-ink/60 mb-1">
                Ubicación
              </label>
              <input
                id="nuevo-location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Bogotá, Colombia"
                className="input w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nuevo-budget" className="block text-[11px] text-ink/60 mb-1">
              Presupuesto estimado (COP)
            </label>
            <input
              id="nuevo-budget"
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
              <label htmlFor="nuevo-startDate" className="block text-[11px] text-ink/60 mb-1">
                Fecha de inicio
              </label>
              <input
                id="nuevo-startDate"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
            <div>
              <label htmlFor="nuevo-endDate" className="block text-[11px] text-ink/60 mb-1">
                Entrega estimada
              </label>
              <input
                id="nuevo-endDate"
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={handleChange}
                className="input w-full text-[13px]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nuevo-description" className="block text-[11px] text-ink/60 mb-1">
              Descripción / alcance inicial
            </label>
            <textarea
              id="nuevo-description"
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
