// src/lib/notifications.js
// Crea notificaciones in-app (Firestore) y envía push FCM al cliente
import {
  collection, addDoc, serverTimestamp,
  query, where, getDocs, limit,
} from "firebase/firestore";
import { db } from "./firebase";

/* ─────────────────────────────────────────────────────────────
   notifyAdmins
   Envia notificacion a todos los usuarios con role === "admin"
───────────────────────────────────────────────────────────── */
export async function notifyAdmins(payload) {
  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "==", "admin"), limit(20))
    );
    await Promise.all(
      snap.docs.map(d => createNotification(d.id, payload))
    );
  } catch (e) {
    console.error("notifyAdmins error:", e.message || e);
  }
}

/* ─────────────────────────────────────────────────────────────
   createNotification
   Escribe en Firestore + dispara push FCM si el cliente tiene token
───────────────────────────────────────────────────────────── */
export async function createNotification(toUid, payload) {
  if (!toUid || !payload?.title) return;

  // 1 ── Notificación in-app (tiempo real vía onSnapshot)
  try {
    await addDoc(collection(db, "notifications", toUid, "items"), {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) { console.error("createNotification in-app error:", e.message || e); }

  // 2 ── Push FCM via Cloud Function
  try {
    const projectIdFirebase = db.app.options.projectId;
    const fnUrl = `https://us-central1-${projectIdFirebase}.cloudfunctions.net/sendPush`;

    await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: toUid,
        title: payload.title,
        body: payload.body || "",
        data: {
          type: payload.type || "general",
          projectId: payload.projectId || "",
          projectName: payload.projectName || "",
          phaseId: payload.phaseId || "",
          phaseName: payload.phaseName || "",
        },
      }),
    });
  } catch (e) { console.error("Push FCM error:", e.message || e); }
}

/* ─────────────────────────────────────────────────────────────
   detectChanges
   Compara fases anteriores vs nuevas y devuelve qué notificar
───────────────────────────────────────────────────────────── */
export function detectChanges(prevFases = [], nextFases = [], projectProgress = 0, prevProgress = 0) {
  const notifications = [];

  for (const next of nextFases) {
    const prev = prevFases.find(f => f.id === next.id);
    if (!prev) continue;

    const prevPct = Number(prev.porcentaje) || 0;
    const nextPct = Number(next.porcentaje) || 0;
    const prevEst = prev.estado || "pendiente";
    const nextEst = next.estado || "pendiente";

    // Fase completada
    if (prevEst !== "completada" && (nextEst === "completada" || nextPct >= 100)) {
      notifications.push({
        type: "phase_done",
        title: "Etapa completada ✓",
        body: `"${next.nombre}" ha sido finalizada por el equipo.`,
        phaseId: next.id,
        phaseName: next.nombre,
      });
      continue;
    }

    // Fase inició
    if (prevEst === "pendiente" && (nextEst === "en_curso" || (prevPct === 0 && nextPct > 0))) {
      notifications.push({
        type: "phase_started",
        title: "Nueva etapa en curso",
        body: `El equipo comenzó a trabajar en "${next.nombre}".`,
        phaseId: next.id,
        phaseName: next.nombre,
      });
    }
  }

  // Avance global +10 puntos o más
  if (projectProgress - prevProgress >= 10) {
    notifications.push({
      type: "progress_update",
      title: `Tu proyecto avanzó al ${projectProgress}%`,
      body: `El equipo registró nuevos avances. Tu proyecto va al ${projectProgress}% de progreso.`,
      progress: projectProgress,
    });
  }

  return notifications;
}

/* ─────────────────────────────────────────────────────────────
   getClientUid
   Obtiene el UID del cliente del proyecto
───────────────────────────────────────────────────────────── */
export async function getClientUid(projectData) {
  if (projectData?.clientId) return projectData.clientId;

  const email = projectData?.clientEmail;
  if (!email) return null;

  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("email", "==", email.toLowerCase()), limit(1))
    );
    if (!snap.empty) return snap.docs[0].id;
  } catch (e) { console.error("getClientUid error:", e.message || e); }

  return null;
}