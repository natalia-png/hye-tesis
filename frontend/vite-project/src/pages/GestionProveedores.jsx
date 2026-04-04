// src/pages/GestionProveedores.jsx
// CRUD de proveedores externos — sin cuenta en la app, solo trazabilidad

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
    collection, onSnapshot, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, query, where, getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const ESPECIALIDADES_SUGERIDAS = [
    "Construcción", "Eléctrico", "Hidráulico", "Estructura",
    "Acabados", "Carpintería", "Vidriería", "Paisajismo",
];

export default function GestionProveedores() {
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | "nuevo" | { id, ...data }
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [proyectosModal, setProyectosModal] = useState(null); // { prov, proyectos[] }

    const emptyForm = { name: "", specialty: "", phone: "", email: "", nit: "", notes: "" };
    const [form, setForm] = useState(emptyForm);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "proveedores"),
            snap => {
                setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            },
            () => setLoading(false)
        );
        return () => { try { unsub(); } catch (e) { console.error(e); } };
    }, []);

    const openNuevo = () => {
        setForm(emptyForm);
        setError("");
        setModal("nuevo");
    };

    const openEditar = (prov) => {
        setForm({
            name: prov.name || "",
            specialty: prov.specialty || "",
            phone: prov.phone || "",
            email: prov.email || "",
            nit: prov.nit || "",
            notes: prov.notes || "",
        });
        setError("");
        setModal(prov);
    };

    const handleGuardar = async () => {
        if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
        setSaving(true);
        setError("");
        try {
            const payload = {
                name: form.name.trim(),
                specialty: form.specialty.trim(),
                phone: form.phone.trim(),
                email: form.email.trim().toLowerCase(),
                nit: form.nit.trim(),
                notes: form.notes.trim(),
            };
            if (modal === "nuevo") {
                await addDoc(collection(db, "proveedores"), { ...payload, createdAt: serverTimestamp() });
            } else {
                await updateDoc(doc(db, "proveedores", modal.id), payload);
            }
            setModal(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEliminar = async (prov) => {
        if (!confirm(`¿Eliminar a "${prov.name}" de la lista de proveedores?`)) return;
        try {
            await deleteDoc(doc(db, "proveedores", prov.id));
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    const verProyectos = async (prov) => {
        try {
            const q = query(
                collection(db, "projects"),
                where("proveedoresIds", "array-contains", prov.id)
            );
            const snap = await getDocs(q);
            const proyectos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setProyectosModal({ prov, proyectos });
        } catch (e) {
            alert("Error al cargar proyectos: " + e.message);
        }
    };

    const filtered = proveedores.filter(p =>
        !search ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.specialty?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <section className="space-y-4">

            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                        Terceros externos
                    </p>
                    <h1 className="text-[20px] font-bold text-ink leading-tight">Proveedores</h1>
                    <p className="text-[12px] text-ink/50 mt-0.5">
                        {proveedores.length} proveedor{proveedores.length === 1 ? "" : "es"} registrado{proveedores.length === 1 ? "" : "s"}
                    </p>
                </div>
                <button type="button" onClick={openNuevo}
                    className="btn-primary text-[12px] px-3 py-2 flex-shrink-0 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar
                </button>
            </div>

            {/* Buscador */}
            {proveedores.length > 3 && (
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/30"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                    </svg>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o especialidad…"
                        className="w-full border border-taupe/30 rounded-xl pl-8 pr-3 py-2 text-[12px] bg-ivory dark:bg-[#1e1c1a] outline-none focus:border-ink/40 text-ink placeholder:text-ink/30" />
                </div>
            )}

            {loading && (
                <div className="flex items-center gap-2 py-6">
                    <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
                    <p className="text-[13px] text-ink/50">Cargando proveedores…</p>
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">🏗️</p>
                    <p className="text-[14px] font-semibold text-ink">
                        {search ? "Sin resultados" : "Sin proveedores aún"}
                    </p>
                    <p className="text-[12px] text-ink/50 max-w-[220px] mx-auto leading-relaxed">
                        {search
                            ? "Intenta con otro término de búsqueda."
                            : "Agrega los proveedores para asignarlos a proyectos y llevar trazabilidad."}
                    </p>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="space-y-2">
                    {filtered.map(p => (
                        <TarjetaProveedor key={p.id} proveedor={p}
                            onEditar={openEditar}
                            onEliminar={handleEliminar}
                            onVerProyectos={verProyectos} />
                    ))}
                </div>
            )}

            {/* Modal crear / editar */}
            {modal !== null && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
                    <div className="w-full max-w-[460px] bg-white dark:bg-[#252320] rounded-2xl shadow-2xl space-y-4 p-5 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[15px] font-semibold text-ink">
                                {modal === "nuevo" ? "Agregar proveedor" : "Editar proveedor"}
                            </h3>
                            <button onClick={() => setModal(null)} className="text-ink/40 hover:text-ink text-xl">×</button>
                        </div>

                        {/* Especialidad chips */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Especialidad</label>
                            <div className="flex gap-1.5 flex-wrap">
                                {ESPECIALIDADES_SUGERIDAS.map(s => (
                                    <button key={s} type="button" onClick={() => set("specialty", s)}
                                        className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${form.specialty === s
                                            ? "bg-ink text-ivory border-ink"
                                            : "bg-white dark:bg-[#1e1c1a] text-ink/60 border-ink/15 hover:border-ink/30"
                                        }`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={form.specialty}
                                onChange={e => set("specialty", e.target.value)}
                                placeholder="O escribe una especialidad personalizada…"
                                className="w-full border border-taupe/30 rounded-xl px-3 py-2 text-[12px] bg-white dark:bg-[#1e1c1a] outline-none focus:border-ink/40 text-ink placeholder:text-ink/30 mt-1"
                            />
                        </div>

                        {/* Nombre */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Nombre / Razón social *</label>
                            <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
                                placeholder="Ej: Construex S.A.S." className="input w-full text-[13px]" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Teléfono</label>
                                <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
                                    placeholder="Ej: 3001234567" className="input w-full text-[13px]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">NIT / RUT</label>
                                <input type="text" value={form.nit} onChange={e => set("nit", e.target.value)}
                                    placeholder="Ej: 900123456-1" className="input w-full text-[13px]" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Correo electrónico</label>
                            <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                                placeholder="contacto@proveedor.com" className="input w-full text-[13px]" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Notas internas</label>
                            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                                placeholder="Observaciones, condiciones, contacto adicional…"
                                rows={3}
                                className="w-full border border-taupe/30 rounded-xl px-3 py-2 text-[12px] bg-white dark:bg-[#1e1c1a] outline-none focus:border-ink/40 text-ink placeholder:text-ink/30 resize-none" />
                        </div>

                        {error && <p className="text-[12px] text-red-600">{error}</p>}

                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => setModal(null)}
                                className="flex-1 btn-outline text-[13px]" disabled={saving}>
                                Cancelar
                            </button>
                            <button type="button" onClick={handleGuardar} disabled={saving}
                                className="flex-1 btn-primary text-[13px] disabled:opacity-50">
                                {saving ? "Guardando…" : modal === "nuevo" ? "Agregar" : "Guardar cambios"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal proyectos del proveedor */}
            {proyectosModal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
                    <div className="w-full max-w-[460px] bg-white dark:bg-[#252320] rounded-2xl shadow-2xl space-y-3 p-5 max-h-[70vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40">Trazabilidad</p>
                                <h3 className="text-[15px] font-semibold text-ink">{proyectosModal.prov.name}</h3>
                            </div>
                            <button onClick={() => setProyectosModal(null)} className="text-ink/40 hover:text-ink text-xl">×</button>
                        </div>
                        {proyectosModal.proyectos.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-2xl mb-2">📋</p>
                                <p className="text-[13px] text-ink/50">Sin proyectos asignados aún</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {proyectosModal.proyectos.map(p => (
                                    <div key={p.id} className="card flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-ink truncate">{p.name}</p>
                                            {p.code && <p className="text-[11px] text-ink/50">{p.code}</p>}
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                            p.status === "completado"
                                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/30 dark:text-emerald-400"
                                                : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700/30 dark:text-amber-400"
                                        }`}>
                                            {p.status === "completado" ? "Completado" : "En curso"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button type="button" onClick={() => setProyectosModal(null)}
                            className="w-full btn-outline text-[13px] mt-2">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}

function TarjetaProveedor({ proveedor, onEditar, onEliminar, onVerProyectos }) {
    const initial = (proveedor.name || "?")[0].toUpperCase();

    return (
        <div className="card space-y-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-[14px] font-bold text-white">{initial}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{proveedor.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            {proveedor.specialty && (
                                <span className="text-[11px] text-ink/50">{proveedor.specialty}</span>
                            )}
                            {proveedor.nit && (
                                <span className="text-[10px] text-ink/35 font-mono">NIT: {proveedor.nit}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Ver proyectos */}
                    <button type="button" onClick={() => onVerProyectos(proveedor)}
                        title="Ver proyectos asignados"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                    </button>
                    {/* Editar */}
                    <button type="button" onClick={() => onEditar(proveedor)}
                        title="Editar proveedor"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-ink hover:bg-ink/10 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    {/* Eliminar */}
                    <button type="button" onClick={() => onEliminar(proveedor)}
                        title="Eliminar proveedor"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Info de contacto */}
            {(proveedor.phone || proveedor.email) && (
                <div className="flex items-center gap-3 pt-1 border-t border-taupe/15 flex-wrap">
                    {proveedor.phone && (
                        <a href={`tel:${proveedor.phone}`}
                            className="flex items-center gap-1 text-[11px] text-ink/50 hover:text-ink transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {proveedor.phone}
                        </a>
                    )}
                    {proveedor.email && (
                        <a href={`mailto:${proveedor.email}`}
                            className="flex items-center gap-1 text-[11px] text-ink/50 hover:text-ink transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {proveedor.email}
                        </a>
                    )}
                </div>
            )}

            {proveedor.notes && (
                <p className="text-[11px] text-ink/45 italic leading-relaxed pt-0.5">{proveedor.notes}</p>
            )}
        </div>
    );
}

TarjetaProveedor.propTypes = {
    proveedor: PropTypes.object.isRequired,
    onEditar: PropTypes.func.isRequired,
    onEliminar: PropTypes.func.isRequired,
    onVerProyectos: PropTypes.func.isRequired,
};
