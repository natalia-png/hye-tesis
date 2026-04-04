// src/pages/ProyectoNuevo.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp, getDocs, getDoc, doc, query, where, getDocsFromServer } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getAuth } from "firebase/auth";
import { cloneFases, DEFAULT_FASES } from "../data/fases";
import { useAuth } from "../app/useAuth";

const FUNCTIONS_URL = "https://us-central1-hye-tesis.cloudfunctions.net";

async function crearClienteNuevo(name, email, extras = {}) {
  const token = await getAuth().currentUser.getIdToken();
  const res = await fetch(`${FUNCTIONS_URL}/crearCliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ name, email, ...extras }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al crear el cliente");
  return data.uid;
}

async function actualizarCliente(uid, extras = {}) {
  const token = await getAuth().currentUser.getIdToken();
  const res = await fetch(`${FUNCTIONS_URL}/actualizarCliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ uid, ...extras }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al actualizar el cliente");
}

const TIPOS_SUGERIDOS = [
  "Vivienda unifamiliar", "Edificio de vivienda", "Oficinas",
  "Comercial", "Institucional",
];

const INITIAL_FORM = {
  code: "", name: "", client: "", clientEmail: "", clientPhone: "",
  clientAddress: "", clientCedula: "", type: "", projectAddress: "", city: "",
  budget: "", startDate: "", endDate: "", description: "",
};

export default function ProyectoNuevo() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Cliente
  const [clienteMode, setClienteMode] = useState("existente"); // "existente" | "nuevo"
  const [clientes, setClientes] = useState([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [loadingClientes, setLoadingClientes] = useState(true);

  // ── Proveedores
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState([]);
  const [provSearch, setProvSearch] = useState("");
  const [loadingProv, setLoadingProv] = useState(true);

  useEffect(() => {
    // Cargar clientes existentes directo del servidor (sin caché)
    getDocsFromServer(query(collection(db, "users"), where("role", "==", "cliente")))
      .then(snap => setClientes(snap.docs.map(d => ({ uid: d.id, ...d.data() }))))
      .finally(() => setLoadingClientes(false));

    // Cargar proveedores
    getDocs(collection(db, "proveedores"))
      .then(snap => setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))))
      .finally(() => setLoadingProv(false));
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = clienteSearch.toLowerCase();
    return clientes.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  }, [clientes, clienteSearch]);

  const provFiltrados = useMemo(() => {
    const q = provSearch.toLowerCase();
    return proveedores.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.specialty || "").toLowerCase().includes(q)
    );
  }, [proveedores, provSearch]);

  const seleccionarCliente = async (cliente) => {
    setClienteSeleccionado(cliente);
    // Traer datos frescos del servidor para asegurar teléfono, cédula, etc.
    try {
      const snap = await getDoc(doc(db, "users", cliente.uid));
      const data = snap.exists() ? { uid: snap.id, ...snap.data() } : cliente;
      setForm(f => ({
        ...f,
        client: data.name || "",
        clientEmail: data.email || "",
        clientPhone: data.phone || "",
        clientCedula: data.cedula || "",
        projectAddress: data.address || "",
        city: data.city || "",
      }));
    } catch {
      setForm(f => ({
        ...f,
        client: cliente.name || "",
        clientEmail: cliente.email || "",
        clientPhone: cliente.phone || "",
        clientCedula: cliente.cedula || "",
        projectAddress: cliente.address || "",
        city: cliente.city || "",
      }));
    }
    setClienteSearch("");
  };

  const limpiarCliente = () => {
    setClienteSeleccionado(null);
    setForm(f => ({ ...f, client: "", clientEmail: "", clientPhone: "", clientCedula: "", projectAddress: "", city: "" }));
  };

  const toggleProveedor = (prov) => {
    setProveedoresSeleccionados(prev =>
      prev.find(p => p.id === prov.id)
        ? prev.filter(p => p.id !== prov.id)
        : [...prev, { id: prov.id, name: prov.name, specialty: prov.specialty || "" }]
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("El nombre del proyecto es obligatorio."); return; }
    if (clienteMode === "existente" && !clienteSeleccionado) {
      setError("Selecciona un cliente existente o cambia a cliente nuevo."); return;
    }
    if (clienteMode === "nuevo" && !form.client.trim()) {
      setError("El nombre del cliente es obligatorio."); return;
    }

    setSaving(true);
    try {
      let clientId = null;
      const email = form.clientEmail.trim().toLowerCase();

      const extras = {
        phone:   form.clientPhone.trim()    || undefined,
        cedula:  form.clientCedula.trim()   || undefined,
        address: form.projectAddress.trim() || undefined,
        city:    form.city.trim()           || undefined,
      };

      if (clienteMode === "existente" && clienteSeleccionado) {
        clientId = clienteSeleccionado.uid;
        // Actualizar datos del cliente vía cloud function (Admin SDK, sin reglas)
        await actualizarCliente(clientId, { name: form.client.trim(), ...extras });
      } else if (email) {
        const snap = await getDocs(query(collection(db, "users"),
          where("email", "==", email), where("role", "==", "cliente")));
        if (!snap.empty) {
          clientId = snap.docs[0].id;
          await actualizarCliente(clientId, { name: form.client.trim(), ...extras });
        } else {
          clientId = await crearClienteNuevo(form.client.trim(), email, extras);
        }
      }

      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        client: form.client.trim(),
        clientId,
        clientEmail: email || null,
        clientPhone: form.clientPhone.trim() || null,
        clientAddress: form.clientAddress.trim() || null,
        clientCedula: form.clientCedula.trim() || null,
        type: form.type.trim() || null,
        projectAddress: form.projectAddress.trim() || null,
        city: form.city.trim() || null,
        location: [form.projectAddress.trim(), form.city.trim()].filter(Boolean).join(", ") || null,
        budget: form.budget ? Number(form.budget) : null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        description: form.description.trim() || "",
        proveedores: proveedoresSeleccionados,
        proveedoresIds: proveedoresSeleccionados.map(p => p.id),
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
      setError(e.message || "No se pudo crear el proyecto. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={() => nav("/proyectos")}
          className="text-[12px] text-ink/70 hover:text-ink inline-flex items-center">
          ‹ Volver a proyectos
        </button>
      </div>

      <div className="card space-y-4">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-ink/50">Nuevo proyecto</p>
          <h1 className="text-[18px] font-semibold text-ink leading-snug">Registrar proyecto</h1>
        </div>

        {error && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Código + Nombre ── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-[11px] text-ink/60 mb-1">Código interno</label>
              <input name="code" value={form.code} onChange={handleChange}
                placeholder="ARQ-004" className="input w-full text-[13px]" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-ink/60 mb-1">Nombre del proyecto *</label>
              <input name="name" value={form.name} onChange={handleChange}
                placeholder="Casa Nogal II" className="input w-full text-[13px]" required />
            </div>
          </div>

          {/* ══ SECCIÓN CLIENTE ══ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-ink">Cliente</p>
              {/* Toggle existente / nuevo */}
              <div className="flex rounded-lg border border-taupe/30 overflow-hidden text-[11px]">
                {["existente", "nuevo"].map(mode => (
                  <button key={mode} type="button"
                    onClick={() => { setClienteMode(mode); limpiarCliente(); }}
                    className={`px-3 py-1 font-medium transition capitalize ${
                      clienteMode === mode ? "bg-ink text-ivory" : "text-ink/60"
                    }`}>
                    {mode === "existente" ? "Existente" : "Nuevo"}
                  </button>
                ))}
              </div>
            </div>

            {clienteMode === "existente" ? (
              clienteSeleccionado ? (
                /* Cliente seleccionado — campos editables con badge de vinculación */
                <div className="space-y-2.5 rounded-xl border border-emerald-200 dark:border-emerald-700/40 p-3 bg-emerald-50 dark:bg-emerald-900/15">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Cliente vinculado — puedes editar los datos
                      </span>
                    </div>
                    <button type="button" onClick={limpiarCliente}
                      className="text-[11px] text-ink/50 hover:text-red-500 underline">
                      Cambiar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-ink/60 mb-1">Nombre / razón social *</label>
                      <input name="client" value={form.client} onChange={handleChange}
                        placeholder="Familia Pérez" className="input w-full text-[13px]" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-ink/60 mb-1">Cédula / NIT</label>
                      <input name="clientCedula" value={form.clientCedula} onChange={handleChange}
                        placeholder="1234567890" className="input w-full text-[13px]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink/60 mb-1">Correo electrónico</label>
                    <input name="clientEmail" type="email" value={form.clientEmail} onChange={handleChange}
                      placeholder="cliente@correo.com" className="input w-full text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink/60 mb-1">Teléfono</label>
                    <input name="clientPhone" value={form.clientPhone} onChange={handleChange}
                      placeholder="310 000 0000" className="input w-full text-[13px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-ink/60 mb-1">Dirección</label>
                      <input name="projectAddress" value={form.projectAddress} onChange={handleChange}
                        placeholder="Cra 7 # 45-10" className="input w-full text-[13px]" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-ink/60 mb-1">Ciudad</label>
                      <input name="city" value={form.city} onChange={handleChange}
                        placeholder="Bogotá" className="input w-full text-[13px]" />
                    </div>
                  </div>
                </div>
              ) : (
                /* Buscador de clientes */
                <div className="space-y-2">
                  <input
                    value={clienteSearch}
                    onChange={e => setClienteSearch(e.target.value)}
                    placeholder="Buscar por nombre o correo…"
                    className="input w-full text-[13px]"
                  />
                  {loadingClientes ? (
                    <p className="text-[12px] text-ink/50 px-1">Cargando clientes…</p>
                  ) : clientesFiltrados.length === 0 ? (
                    <p className="text-[12px] text-ink/50 px-1">
                      {clientes.length === 0 ? "No hay clientes registrados aún." : "Sin resultados."}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-taupe/25 divide-y divide-taupe/10"
                      style={{ background: "rgb(var(--ivory))" }}>
                      {clientesFiltrados.map(c => (
                        <button key={c.uid} type="button" onClick={() => seleccionarCliente(c)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-sand/60 transition">
                          <div className="w-7 h-7 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-ivory">{(c.name || "?")[0].toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-ink truncate">{c.name}</p>
                            <p className="text-[11px] text-ink/50 truncate">{c.email}</p>
                          </div>
                          {c.phone && <p className="text-[11px] text-ink/40 flex-shrink-0">{c.phone}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              /* Formulario cliente nuevo */
              <div className="space-y-2.5 rounded-xl border border-taupe/25 p-3"
                style={{ background: "rgb(var(--sand) / 0.35)" }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-ink/60 mb-1">Nombre / razón social *</label>
                    <input name="client" value={form.client} onChange={handleChange}
                      placeholder="Familia Pérez" className="input w-full text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink/60 mb-1">Cédula / NIT</label>
                    <input name="clientCedula" value={form.clientCedula} onChange={handleChange}
                      placeholder="1234567890" className="input w-full text-[13px]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-ink/60 mb-1">Correo electrónico</label>
                  <input name="clientEmail" type="email" value={form.clientEmail} onChange={handleChange}
                    placeholder="cliente@correo.com" className="input w-full text-[13px]" />
                </div>
                <div>
                  <label className="block text-[11px] text-ink/60 mb-1">Teléfono</label>
                  <input name="clientPhone" value={form.clientPhone} onChange={handleChange}
                    placeholder="310 000 0000" className="input w-full text-[13px]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-ink/60 mb-1">Dirección</label>
                    <input name="projectAddress" value={form.projectAddress} onChange={handleChange}
                      placeholder="Cra 7 # 45-10" className="input w-full text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-ink/60 mb-1">Ciudad</label>
                    <input name="city" value={form.city} onChange={handleChange}
                      placeholder="Bogotá" className="input w-full text-[13px]" />
                  </div>
                </div>
                {form.clientEmail && (
                  <p className="text-[11px] text-ink/50">
                    Se creará una cuenta y se enviará correo de bienvenida al cliente.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Tipo de proyecto ── */}
          <div className="space-y-2">
            <label className="block text-[11px] text-ink/60">Tipo de proyecto</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_SUGERIDOS.map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, type: f.type === t ? "" : t }))}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${
                    form.type === t
                      ? "bg-ink text-ivory border-ink"
                      : "bg-white dark:bg-[#1e1c1a] text-ink/60 border-ink/15 hover:border-ink/30"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            {/* Campo libre — activo cuando no coincide con los chips */}
            <input name="type" value={form.type} onChange={handleChange}
              placeholder="O escribe un tipo personalizado…"
              className="input w-full text-[13px]" />
          </div>

          {/* ── Presupuesto ── */}
          <div>
            <label className="block text-[11px] text-ink/60 mb-1">Presupuesto estimado (COP)</label>
            <input name="budget" type="number" min="0" value={form.budget} onChange={handleChange}
              placeholder="250000000" className="input w-full text-[13px]" />
          </div>

          {/* ── Fechas ── */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">Fecha de inicio</label>
              <input name="startDate" type="date" value={form.startDate} onChange={handleChange}
                className="input w-full text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] text-ink/60 mb-1">Entrega estimada</label>
              <input name="endDate" type="date" value={form.endDate} onChange={handleChange}
                className="input w-full text-[13px]" />
            </div>
          </div>

          {/* ── Descripción ── */}
          <div>
            <label className="block text-[11px] text-ink/60 mb-1">Descripción / alcance</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              rows={3} maxLength={800} placeholder="Breve descripción del encargo…"
              className="input w-full text-[13px] resize-none" />
          </div>

          {/* ══ SECCIÓN PROVEEDORES ══ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-ink">Proveedores asignados</p>
              {proveedoresSeleccionados.length > 0 && (
                <span className="text-[11px] text-ink/50">{proveedoresSeleccionados.length} seleccionado{proveedoresSeleccionados.length > 1 ? "s" : ""}</span>
              )}
            </div>

            {/* Chips de seleccionados */}
            {proveedoresSeleccionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {proveedoresSeleccionados.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink text-ivory text-[11px] font-medium">
                    {p.name}
                    <button type="button" onClick={() => toggleProveedor(p)}
                      className="ml-0.5 opacity-60 hover:opacity-100 text-[14px] leading-none">×</button>
                  </span>
                ))}
              </div>
            )}

            {loadingProv ? (
              <p className="text-[12px] text-ink/50">Cargando proveedores…</p>
            ) : proveedores.length === 0 ? (
              <p className="text-[12px] text-ink/50">
                No hay proveedores registrados.{" "}
                <button type="button" onClick={() => nav("/proveedores")}
                  className="underline text-ink/70">Ir a Proveedores →</button>
              </p>
            ) : (
              <div className="space-y-1.5">
                <input value={provSearch} onChange={e => setProvSearch(e.target.value)}
                  placeholder="Buscar proveedor…"
                  className="input w-full text-[13px]" />
                <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-taupe/25 divide-y divide-taupe/10"
                  style={{ background: "rgb(var(--ivory))" }}>
                  {provFiltrados.map(p => {
                    const sel = !!proveedoresSeleccionados.find(s => s.id === p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => toggleProveedor(p)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${sel ? "bg-ink/[0.06]" : "hover:bg-sand/60"}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          sel ? "bg-ink border-ink" : "border-taupe/50"}`}>
                          {sel && <svg className="w-2.5 h-2.5 text-ivory" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-ink truncate">{p.name}</p>
                          {p.specialty && <p className="text-[11px] text-ink/50">{p.specialty}</p>}
                        </div>
                        {p.phone && <p className="text-[11px] text-ink/40 flex-shrink-0">{p.phone}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Botones ── */}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => nav("/proyectos")}
              className="btn-outline text-[13px]" disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary text-[13px]">
              {saving ? "Guardando…" : "Crear proyecto"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
