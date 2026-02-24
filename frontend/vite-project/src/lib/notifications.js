// src/lib/notifications.js
// Opción C — Firestore Trigger
//
// El frontend SOLO escribe en Firestore.
// La Cloud Function onNotificationCreated se activa automáticamente
// en el servidor y envía el push FCM sin que el frontend haga nada más.
//
// Ventaja: si el cliente pierde conexión a mitad del guardado,
// Firestore sincroniza en cuanto recupera red y el trigger dispara igual.

import {
  collection, addDoc, serverTimestamp,
  query, where, getDocs, limit,
} from "firebase/firestore";
import { db } from "./firebase";

/* ─────────────────────────────────────────────────────────────
   createNotification
   Escribe en Firestore → el trigger del servidor envía el push
───────────────────────────────────────────────────────────── */
export async function createNotification(toUid, payload) {
  if (!toUid || !payload?.title) return;

  try {
    await addDoc(collection(db, "notifications", toUid, "items"), {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    });
    // ✅ Eso es todo — la Cloud Function se encarga del push automáticamente
  } catch (e) {
    console.error("createNotification:", e);
  }
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
      continue;
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
   Obtiene el UID del cliente de un proyecto
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
  } catch (e) {
    console.error("getClientUid:", e);
  }

  return null;
}