"use strict";

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Configurar transporte de email (Gmail)
// Requiere: firebase functions:config:set gmail.user="..." gmail.pass="..."
function getTransporter() {
  const user = process.env.GMAIL_USER || (functions?.config?.()?.gmail?.user);
  const pass = process.env.GMAIL_PASS || (functions?.config?.()?.gmail?.pass);
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// En firebase-functions v6 los triggers se importan directamente
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/firestore");

const { onRequest } = require("firebase-functions/https");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/* ═══════════════════════════════════════════════════════════════
   TRIGGER 1 — Notificación in-app creada
   notifications/{userId}/items/{notifId}
═══════════════════════════════════════════════════════════════ */
exports.onNotificationCreated = onDocumentCreated(
  "notifications/{userId}/items/{notifId}",
  async (event) => {
    const { userId } = event.params;
    const data = event.data?.data();
    if (!data?.title) return;

    return sendPushToUser(userId, {
      title: data.title,
      body: data.body || "",
      type: data.type || "general",
      projectId: data.projectId || "",
      projectName: data.projectName || "",
      phaseId: data.phaseId || "",
      phaseName: data.phaseName || "",
    });
  }
);

/* ═══════════════════════════════════════════════════════════════
   TRIGGER 2 — Nueva nota en una fase
   projects/{projectId}/fases/{phaseId}/notas/{notaId}
═══════════════════════════════════════════════════════════════ */
exports.onNotaCreated = onDocumentCreated(
  "projects/{projectId}/fases/{phaseId}/notas/{notaId}",
  async (event) => {
    const { projectId, phaseId } = event.params;
    const nota = event.data?.data();
    if (!nota) return;

    const { clientUid, projectName, phaseName } =
      await getProjectContext(projectId, phaseId);
    if (!clientUid) return;

    const payload = {
      type: "new_note",
      title: `Nueva nota en ${phaseName || "tu proyecto"}`,
      body: (nota.text || "").substring(0, 120) || "El equipo agregó una actualización.",
      projectId,
      projectName,
      phaseId,
      phaseName,
    };

    return Promise.all([
      sendPushToUser(clientUid, payload),
      createInAppNotification(clientUid, payload),
    ]);
  }
);

/* ═══════════════════════════════════════════════════════════════
   TRIGGER 3 — Archivo publicado al cliente
   Solo cuando visibleToClient cambia false → true
═══════════════════════════════════════════════════════════════ */
exports.onArchivoPublicado = onDocumentWritten(
  "projects/{projectId}/fases/{phaseId}/archivos/{archivoId}",
  async (event) => {
    const { projectId, phaseId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after?.visibleToClient || before?.visibleToClient) return;

    const { clientUid, projectName, phaseName } =
      await getProjectContext(projectId, phaseId);
    if (!clientUid) return;

    const fileName = after.fileName || "un archivo";
    const payload = {
      type: "new_file",
      title: "Nuevo documento disponible",
      body: `"${fileName}" ya está disponible en ${phaseName || "tu proyecto"}.`,
      projectId,
      projectName,
      phaseId,
      phaseName,
    };

    return Promise.all([
      sendPushToUser(clientUid, payload),
      createInAppNotification(clientUid, payload),
    ]);
  }
);

/* ═══════════════════════════════════════════════════════════════
   TRIGGER 4 — Avance de fase ≥ 25% sin completarse
═══════════════════════════════════════════════════════════════ */
exports.onFaseAvance = onDocumentUpdated(
  "projects/{projectId}",
  async (event) => {
    const { projectId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const prevFases = before.fases || [];
    const nextFases = after.fases || [];

    const faseAvanzada = nextFases.find((next) => {
      const prev = prevFases.find(f => f.id === next.id);
      if (!prev) return false;
      const subio = (Number(next.porcentaje) || 0) - (Number(prev.porcentaje) || 0) >= 25;
      const noCien = (Number(next.porcentaje) || 0) < 100;
      return subio && noCien;
    });

    if (!faseAvanzada) return;

    const { clientUid, projectName } = await getProjectContext(projectId, null);
    if (!clientUid) return;

    const pct = Number(faseAvanzada.porcentaje) || 0;
    const payload = {
      type: "progress_update",
      title: `Avance en ${faseAvanzada.nombre}`,
      body: `La fase "${faseAvanzada.nombre}" avanzó al ${pct}%.`,
      projectId,
      projectName,
      phaseId: faseAvanzada.id,
      phaseName: faseAvanzada.nombre,
    };

    return Promise.all([
      sendPushToUser(clientUid, payload),
      createInAppNotification(clientUid, payload),
    ]);
  }
);

/* ═══════════════════════════════════════════════════════════════
   ENDPOINT HTTP — pruebas manuales
   POST /sendPush  { userId, title, body }
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   TRIGGER 5 — Nueva solicitud de garantía
   garantias/{projectId}/solicitudes/{solicitudId}
═══════════════════════════════════════════════════════════════ */
exports.onGarantiaCreada = onDocumentCreated(
  "garantias/{projectId}/solicitudes/{solicitudId}",
  async (event) => {
    const { projectId } = event.params;
    const solicitud = event.data?.data();
    if (!solicitud) return;

    // Buscar al admin por email fijo
    const adminEmail = "admin@hye.com";
    const adminSnap = await db.collection("users")
      .where("email", "==", adminEmail)
      .limit(1).get();

    if (adminSnap.empty) {
      console.log("Admin no encontrado para notificación de garantía");
      return;
    }

    const adminUid = adminSnap.docs[0].id;

    // Obtener nombre del proyecto
    const projectSnap = await db.collection("projects").doc(projectId).get();
    const projectName = projectSnap.exists
      ? (projectSnap.data().name || projectSnap.data().nombre || "un proyecto")
      : "un proyecto";

    const prioridad = solicitud.prioridad === "urgente" ? "🚨 URGENTE — " : "";
    const payload = {
      type: "nueva_garantia",
      title: `${prioridad}Nueva solicitud de garantía`,
      body: `${solicitud.nombreCliente || "Un cliente"} reportó un problema en ${projectName}.`,
      projectId,
      projectName,
      phaseId: "",
      phaseName: "",
    };

    return Promise.all([
      sendPushToUser(adminUid, payload),
      createInAppNotification(adminUid, payload),
    ]);
  }
);

/* ═══════════════════════════════════════════════════════════════
   TRIGGER 6 — Luisa responde una solicitud de garantía
   Se activa cuando el array "respuestas" crece
═══════════════════════════════════════════════════════════════ */
exports.onGarantiaRespondida = onDocumentUpdated(
  "garantias/{projectId}/solicitudes/{solicitudId}",
  async (event) => {
    const { projectId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Solo actuar si el array de respuestas creció
    const respAntes = (before.respuestas || []).length;
    const respDespues = (after.respuestas || []).length;
    if (respDespues <= respAntes) return;

    // Buscar al cliente por uid guardado en la solicitud
    const clientUid = after.creadoPor;
    if (!clientUid) return;

    const projectSnap = await db.collection("projects").doc(projectId).get();
    const projectName = projectSnap.exists
      ? (projectSnap.data().name || projectSnap.data().nombre || "tu proyecto")
      : "tu proyecto";

    // Última respuesta agregada
    const ultimaRespuesta = after.respuestas[after.respuestas.length - 1];
    const textoPreview = ultimaRespuesta?.texto
      ? ultimaRespuesta.texto.substring(0, 100)
      : ultimaRespuesta?.archivo
        ? `Archivo adjunto: ${ultimaRespuesta.archivo.name}`
        : "El equipo ha respondido tu solicitud.";

    const payload = {
      type: "garantia_respondida",
      title: "Respuesta a tu solicitud de garantía",
      body: textoPreview,
      projectId,
      projectName,
      phaseId: "",
      phaseName: "",
    };

    return Promise.all([
      sendPushToUser(clientUid, payload),
      createInAppNotification(clientUid, payload),
    ]);
  }
);


/* ═══════════════════════════════════════════════════════════════
   TRIGGER 7 — Solicitud comercial aprobada o rechazada
   Envía email al prospecto cuando Luisa cambia el estado
═══════════════════════════════════════════════════════════════ */
exports.onSolicitudComercialUpdated = onDocumentUpdated(
  "solicitudesComerciales/{solicitudId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const estadoAntes = before.estado;
    const estadoDespues = after.estado;

    const esRespuesta = ["aprobada", "rechazada"].includes(estadoDespues);
    if (!esRespuesta || estadoAntes === estadoDespues) return;

    const { email, emailEnviado } = after;
    if (!email || !emailEnviado) return;

    const { asunto, cuerpo } = emailEnviado;
    if (!asunto || !cuerpo) return;

    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: '"H&E Arquitectos" <noreply@hyearquitectos.com>',
        to: email,
        subject: asunto,
        text: cuerpo,
      });
      console.log(`Email enviado a ${email} — estado: ${estadoDespues}`);
    } catch (e) {
      console.error("Error enviando email:", e.message);
    }
  }
);

exports.onSolicitudComercialCreada = onDocumentCreated(
  "solicitudesComerciales/{solicitudId}",
  async (event) => {
    const solicitud = event.data?.data();
    if (!solicitud) return;

    // Buscar uid del admin por email
    const adminSnap = await db.collection("users")
      .where("email", "==", "admin@hye.com")
      .limit(1).get();

    if (adminSnap.empty) return;
    const adminUid = adminSnap.docs[0].id;

    const nombre = solicitud.nombre || "Un prospecto";
    const tipoObra = solicitud.tipoObra || "proyecto";

    const payload = {
      type: "nueva_solicitud_comercial",
      title: "🏗 Nueva solicitud de servicio",
      body: `${nombre} quiere cotizar: ${tipoObra}.`,
      projectId: "",
      projectName: "",
      phaseId: "",
      phaseName: "",
    };

    return Promise.all([
      sendPushToUser(adminUid, payload),
      createInAppNotification(adminUid, payload),
    ]);
  }
);

exports.sendPush = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const { userId, title, body, data = {} } = req.body;
    if (!userId || !title) {
      res.status(400).json({ error: "userId y title son obligatorios" });
      return;
    }
    const tokens = await getUserTokens(userId);
    if (tokens.length === 0) {
      res.status(404).json({ error: `Sin tokens para ${userId}` });
      return;
    }
    try {
      const r = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body: body || "" },
        data: toStrings(data),
      });
      res.json({ success: r.successCount, failure: r.failureCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

async function getProjectContext(projectId, phaseId) {
  try {
    const snap = await db.collection("projects").doc(projectId).get();
    if (!snap.exists) return {};

    const project = snap.data();
    const projectName = project.name || project.nombre || "tu proyecto";

    let clientUid = project.clientId || null;
    if (!clientUid && project.clientEmail) {
      const q = await db.collection("users")
        .where("email", "==", project.clientEmail.toLowerCase())
        .limit(1).get();
      if (!q.empty) clientUid = q.docs[0].id;
    }

    let phaseName = "";
    if (phaseId && Array.isArray(project.fases)) {
      const fase = project.fases.find(f => f.id === phaseId);
      phaseName = fase?.nombre || "";
    }

    return { clientUid, projectName, phaseName };
  } catch (e) {
    console.error("getProjectContext:", e);
    return {};
  }
}

async function getUserTokens(userId) {
  try {
    const snap = await db.collection("users").doc(userId)
      .collection("fcmTokens").get();
    return snap.docs.map(d => d.data().token).filter(Boolean);
  } catch (e) {
    console.error("getUserTokens:", e);
    return [];
  }
}

async function sendPushToUser(userId, payload) {
  const tokens = await getUserTokens(userId);
  if (tokens.length === 0) {
    console.log(`${userId} sin tokens FCM.`);
    return;
  }

  try {
    const r = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: toStrings({
        type: payload.type || "general",
        projectId: payload.projectId || "",
        projectName: payload.projectName || "",
        phaseId: payload.phaseId || "",
        phaseName: payload.phaseName || "",
      }),
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/logo-header.png",
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: payload.projectId
            ? `https://hye-tesis.web.app/mis-proyectos/${payload.projectId}`
            : "https://hye-tesis.web.app",
        },
      },
      android: {
        notification: { channelId: "hye_updates", priority: "high", sound: "default" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    });

    console.log(`Push → ${userId}: ${r.successCount} ok, ${r.failureCount} fallidos`);

    if (r.failureCount > 0) {
      const invalid = [
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
      ];
      const batch = db.batch();
      let cleaned = 0;
      r.responses.forEach((resp, i) => {
        if (!resp.success && invalid.includes(resp.error?.code)) {
          batch.delete(
            db.collection("users").doc(userId)
              .collection("fcmTokens").doc(tokens[i])
          );
          cleaned++;
        }
      });
      if (cleaned > 0) await batch.commit();
    }
  } catch (err) {
    console.error("sendPushToUser:", err);
  }
}

async function createInAppNotification(toUid, payload) {
  try {
    await db.collection("notifications").doc(toUid)
      .collection("items").add({
        ...payload,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.error("createInAppNotification:", e);
  }
}

function toStrings(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, String(v ?? "")])
  );
}