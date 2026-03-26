// src/pages/GestionColaboradores.jsx
// Panel admin — Luisa crea y gestiona colaboradores
// Usa initializeApp secundario para crear usuarios sin cerrar sesión de Luisa

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfig } from "../lib/firebase";

const FUNCTIONS_URL = "https://us-central1-hye-tesis.cloudfunctions.net";
import { SUB_ROLE_LABEL, SUB_ROLE_COLOR } from "../data/roles";

// App secundaria — solo para crear usuarios sin afectar sesión de Luisa
function getSecondaryAuth() {
    const existing = getApps().find(a => a.name === "secondary");
    if (existing) return getAuth(existing);
    const secondaryApp = initializeApp(firebaseConfig, "secondary");
    return getAuth(secondaryApp);
}

const SUB_ROLES_OPTIONS = [
    { value: "juridica", label: "Jurídica" },
    { value: "sistemas", label: "Sistemas" },
    { value: "arquitecto", label: "Arquitecto" },
];

export default function GestionColaboradores() {
    const [colaboradores, setColaboradores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        name: "", email: "", password: "", subRole: "juridica",
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "users"),
            snap => {
                const cols = snap.docs
                    .map(d => ({ uid: d.id, ...d.data() }))
                    .filter(u => u.role === "colaborador");
                setColaboradores(cols);
                setLoading(false);
            },
            () => setLoading(false)
        );
        return () => unsub();
    }, []);

    const handleCrear = async () => {
        if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
            setError("Nombre, correo y contraseña son obligatorios.");
            return;
        }
        if (form.password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            // Crear en Auth usando app secundaria (no afecta sesión de Luisa)
            const secondaryAuth = getSecondaryAuth();
            const cred = await createUserWithEmailAndPassword(
                secondaryAuth,
                form.email.trim().toLowerCase(),
                form.password
            );
            const uid = cred.user.uid;

            // Cerrar sesión en la app secundaria
            await secondaryAuth.signOut();

            // Guardar perfil en Firestore con admin SDK (db principal)
            await setDoc(doc(db, "users", uid), {
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                role: "colaborador",
                subRole: form.subRole,
                createdAt: serverTimestamp(),
            });

            setModal(false);
            setForm({ name: "", email: "", password: "", subRole: "juridica" });
        } catch (e) {
            const msgs = {
                "auth/email-already-in-use": "Este correo ya está registrado.",
                "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
                "auth/invalid-email": "El correo no es válido.",
            };
            setError(msgs[e.code] || "Error al crear el colaborador.");
        } finally {
            setSaving(false);
        }
    };

    const handleEliminar = async (uid, nombre) => {
        if (!confirm(`¿Eliminar a ${nombre} del equipo?`)) return;
        try {
            // Eliminar de Auth + Firestore via Cloud Function
            const mainAuth = getAuth();
            const token = await mainAuth.currentUser.getIdToken();

            const res = await fetch(`${FUNCTIONS_URL}/eliminarColaborador`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ uid }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al eliminar");
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    return (
        <section className="space-y-4">

            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                        Equipo interno
                    </p>
                    <h1 className="text-[20px] font-bold text-ink leading-tight">Colaboradores</h1>
                    <p className="text-[12px] text-ink/50 mt-0.5">
                        {colaboradores.length} miembro{colaboradores.length !== 1 ? "s" : ""} del equipo
                    </p>
                </div>
                <button type="button" onClick={() => { setModal(true); setError(""); }}
                    className="btn-primary text-[12px] px-3 py-2 flex-shrink-0 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar
                </button>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 py-6">
                    <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
                    <p className="text-[13px] text-ink/50">Cargando equipo…</p>
                </div>
            ) : colaboradores.length === 0 ? (
                <div className="card text-center py-10 space-y-2">
                    <p className="text-3xl">👥</p>
                    <p className="text-[14px] font-semibold text-ink">Sin colaboradores aún</p>
                    <p className="text-[12px] text-ink/50 max-w-[220px] mx-auto leading-relaxed">
                        Agrega a los miembros del equipo para asignarles fases en los proyectos.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {colaboradores.map(c => (
                        <TarjetaColaborador key={c.uid} colaborador={c} onEliminar={handleEliminar} />
                    ))}
                </div>
            )}

            {modal && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
                    <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl space-y-4 p-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[15px] font-semibold text-ink">Agregar colaborador</h3>
                            <button onClick={() => setModal(false)} className="text-ink/40 hover:text-ink text-xl">×</button>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="colab-area" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Área</label>
                            <div id="colab-area" className="flex gap-2 flex-wrap">
                                {SUB_ROLES_OPTIONS.map(opt => (
                                    <button key={opt.value} type="button" onClick={() => set("subRole", opt.value)}
                                        className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${form.subRole === opt.value
                                                ? "bg-ink text-ivory border-ink"
                                                : "bg-white text-ink/60 border-ink/15 hover:border-ink/30"
                                            }`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-nombre" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Nombre completo</label>
                            <input id="colab-nombre" type="text" value={form.name} onChange={e => set("name", e.target.value)}
                                placeholder="Ej: Carlos Medina" className="input w-full text-[13px]" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-email" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Correo electrónico</label>
                            <input id="colab-email" type="email" value={form.email} onChange={e => set("email", e.target.value)}
                                placeholder="correo@ejemplo.com" className="input w-full text-[13px]" />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="colab-password" className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">Contraseña temporal</label>
                            <input id="colab-password" type="password" value={form.password} onChange={e => set("password", e.target.value)}
                                placeholder="Mínimo 6 caracteres" className="input w-full text-[13px]" />
                            <p className="text-[10px] text-ink/40">El colaborador puede cambiarla después.</p>
                        </div>

                        {error && <p className="text-[12px] text-red-600">{error}</p>}

                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => setModal(false)}
                                className="flex-1 btn-outline text-[13px]" disabled={saving}>
                                Cancelar
                            </button>
                            <button type="button" onClick={handleCrear} disabled={saving}
                                className="flex-1 btn-primary text-[13px] disabled:opacity-50">
                                {saving ? "Creando…" : "Crear colaborador"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function TarjetaColaborador({ colaborador, onEliminar }) {
    const subRole = colaborador.subRole || "";
    const rolLabel = SUB_ROLE_LABEL[subRole] || "Colaborador";
    const rolColor = SUB_ROLE_COLOR[subRole] || "bg-sand text-ink border-taupe/30";

    return (
        <div className="card flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center flex-shrink-0">
                    <span className="text-[14px] font-bold text-ivory">
                        {(colaborador.name || "?")[0].toUpperCase()}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{colaborador.name}</p>
                    <p className="text-[11px] text-ink/50 truncate">{colaborador.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${rolColor}`}>
                    {rolLabel}
                </span>
                <button type="button" onClick={() => onEliminar(colaborador.uid, colaborador.name)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

TarjetaColaborador.propTypes = {
    colaborador: PropTypes.object,
    onEliminar: PropTypes.func,
};