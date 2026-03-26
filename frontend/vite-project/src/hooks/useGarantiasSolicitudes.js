// src/hooks/useGarantiasSolicitudes.js
import { useState, useEffect } from "react";
import { collection, onSnapshot, orderBy, query, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useGarantiasSolicitudes(projectId) {
    const [projectName, setProjectName] = useState("");
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDoc(doc(db, "projects", projectId)).then(snap => {
            if (snap.exists()) {
                const d = snap.data();
                setProjectName(d.name || d.nombre || "Proyecto");
            }
        }).catch(() => {});
    }, [projectId]);

    useEffect(() => {
        const q = query(
            collection(db, "garantias", projectId, "solicitudes"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, snap => {
            setSolicitudes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, () => setLoading(false));
        return () => { try { unsub(); } catch (_e) { /* ignore */ } };
    }, [projectId]);

    return { projectName, solicitudes, loading };
}
