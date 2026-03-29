"use strict";

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Configurar transporte de email (Gmail)
// Requiere variables de entorno: GMAIL_USER y GMAIL_PASS
// Configurar con: firebase functions:secrets:set GMAIL_USER y GMAIL_PASS
// O en functions/.env para desarrollo local
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) {
    throw new Error("Faltan credenciales de Gmail (GMAIL_USER / GMAIL_PASS)");
  }
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
const { onSchedule } = require("firebase-functions/scheduler");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

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

    return notifyUser(clientUid, payload);
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

    return notifyUser(clientUid, payload);
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

    return notifyUser(clientUid, payload);
  }
);

/* ═══════════════════════════════════════════════════════════════
   ENDPOINT HTTP — pruebas manuales
   POST /sendPush  { userId, title, body }
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   TRIGGER — Nuevo mensaje en un chat
   chats/{chatId}/messages/{messageId}
═══════════════════════════════════════════════════════════════ */
exports.onMessageCreated = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const { chatId } = event.params;
    const message = event.data?.data();
    if (!message?.text || !message?.senderId) return;

    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists) return;
    const chat = chatDoc.data();

    const recipients = (chat.participants || []).filter(uid => uid !== message.senderId);
    if (recipients.length === 0) return;

    const chatName = chat.type === "project"
      ? (chat.projectName || "Proyecto")
      : (message.senderName || "Mensaje nuevo");

    const preview = (message.text || "").substring(0, 80);

    return Promise.all(recipients.map(uid => {
      const payload = {
        type: "new_message",
        title: chatName,
        body: `${message.senderName?.split(" ")[0] || "Alguien"}: ${preview}`,
        projectId: chat.projectId || "",
        projectName: chat.projectName || "",
        phaseId: "",
        phaseName: "",
      };
      return notifyUser(uid, payload);
    }));
  }
);

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

    return notifyUser(adminUid, payload);
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
    const textoArchivoPreview = ultimaRespuesta?.archivo
      ? `Archivo adjunto: ${ultimaRespuesta.archivo.name}`
      : "El equipo ha respondido tu solicitud.";
    const textoPreview = ultimaRespuesta?.texto
      ? ultimaRespuesta.texto.substring(0, 100)
      : textoArchivoPreview;

    const payload = {
      type: "garantia_respondida",
      title: "Respuesta a tu solicitud de garantía",
      body: textoPreview,
      projectId,
      projectName,
      phaseId: "",
      phaseName: "",
    };

    return notifyUser(clientUid, payload);
  }
);


/* ═══════════════════════════════════════════════════════════════
   TRIGGER 7 — Solicitud comercial aprobada o rechazada
   Envía email al prospecto cuando Luisa cambia el estado
═══════════════════════════════════════════════════════════════ */
exports.onSolicitudComercialUpdated = onDocumentUpdated(
  { document: "solicitudesComerciales/{solicitudId}", secrets: ["GMAIL_USER", "GMAIL_PASS"] },
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
        from: `"H&E Arquitectos" <${process.env.GMAIL_USER}>`,
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
  { document: "solicitudesComerciales/{solicitudId}", secrets: ["GMAIL_USER", "GMAIL_PASS"] },
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

    // Enviar notificación al admin y correo de confirmación al prospecto
    return Promise.all([
      notifyUser(adminUid, payload),
      sendEmailConfirmacionSolicitud(solicitud),
    ]);
  }
);


/* ═══════════════════════════════════════════════════════════════
   ENDPOINT — Crear colaborador
   POST /crearColaborador { name, email, password, subRole }
   Solo ejecutable por admin (verificado por token)
═══════════════════════════════════════════════════════════════ */
exports.crearColaborador = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!await verifyAdmin(req, res)) return;

    const { name, email, password, subRole } = req.body;
    if (!name || !email || !password || !subRole) {
      res.status(400).json({ error: "name, email, password y subRole son obligatorios" });
      return;
    }

    try {
      // Crear usuario en Firebase Auth con Admin SDK (no afecta sesión del admin)
      const userRecord = await admin.auth().createUser({
        email: email.trim().toLowerCase(),
        password,
        displayName: name.trim(),
      });

      // Guardar perfil en Firestore
      await db.collection("users").doc(userRecord.uid).set({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: "colaborador",
        subRole: subRole,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (e) {
      const msgs = {
        "auth/email-already-exists": "Este correo ya está registrado.",
        "auth/invalid-email": "El correo no es válido.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
      };
      res.status(400).json({ error: msgs[e.code] || e.message });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   ENDPOINT — Eliminar colaborador
   DELETE /eliminarColaborador { uid }
═══════════════════════════════════════════════════════════════ */
exports.eliminarColaborador = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== "DELETE") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!await verifyAdmin(req, res)) return;

    const { uid } = req.body;
    if (!uid) { res.status(400).json({ error: "uid es obligatorio" }); return; }

    try {
      await admin.auth().deleteUser(uid);
      await db.collection("users").doc(uid).delete();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
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
   ENDPOINT — Crear cliente nuevo
   POST /crearCliente { name, email }
   Crea cuenta en Auth + Firestore + envía email de bienvenida
═══════════════════════════════════════════════════════════════ */
exports.crearCliente = onRequest(
  { cors: true, invoker: "public", secrets: ["GMAIL_USER", "GMAIL_PASS"] },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!await verifyAdmin(req, res)) return;

    const { name, email } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "name y email son obligatorios" });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      // 1 — Crear usuario en Firebase Auth
      const userRecord = await admin.auth().createUser({
        email: cleanEmail,
        displayName: cleanName,
        emailVerified: false,
      });

      // 2 — Guardar perfil en Firestore
      await db.collection("users").doc(userRecord.uid).set({
        name: cleanName,
        email: cleanEmail,
        role: "cliente",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3 — Generar link de establecer contraseña
      const resetLink = await admin.auth().generatePasswordResetLink(cleanEmail);

      // 4 — Enviar email de bienvenida vía Nodemailer
      const transporter = getTransporter();
      const firstName = cleanName.split(" ")[0];
      await transporter.sendMail({
        from: `"H&E Arquitectos" <${process.env.GMAIL_USER}>`,
        to: cleanEmail,
        subject: "Bienvenido/a a H&E Arquitectos — Accede a tu proyecto",
        html: `
          <div style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;">
            <div style="background:#141414;color:white;padding:24px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:1px;">H&E Arquitectos</h1>
            </div>
            <div style="padding:32px;background:#F2EEE7;">
              <p style="font-size:16px;">Hola <strong>${firstName}</strong>,</p>
              <p>Luisa ha creado tu acceso a la <strong>Plataforma de Proyectos H&E Arquitectos</strong>, donde podrás seguir el avance de tu proyecto en tiempo real.</p>
              <p>Para activar tu cuenta y establecer tu contraseña, haz clic en el botón:</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${resetLink}" style="background:#141414;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
                  Establecer mi contraseña →
                </a>
              </div>
              <p style="font-size:13px;color:#666;">Este enlace expira en 24 horas. Si no esperabas este correo, puedes ignorarlo.</p>
              <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />
              <p style="font-size:12px;color:#999;margin:0;">
                <strong>H&E Arquitectos</strong> · Bogotá, Colombia
              </p>
            </div>
          </div>
        `,
        text: `Hola ${firstName},\n\nLuisa ha creado tu acceso a la Plataforma H&E Arquitectos.\n\nEstablece tu contraseña aquí:\n${resetLink}\n\nEste enlace expira en 24 horas.\n\nH&E Arquitectos`,
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (e) {
      const msgs = {
        "auth/email-already-exists": "Este correo ya tiene una cuenta registrada.",
        "auth/invalid-email": "El correo no es válido.",
      };
      res.status(400).json({ error: msgs[e.code] || e.message });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   ENDPOINT — Eliminar proyecto permanentemente
   DELETE /eliminarProyecto { projectId }
   Si el cliente no tiene otros proyectos → elimina su cuenta Auth + Firestore
═══════════════════════════════════════════════════════════════ */
exports.eliminarProyecto = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "DELETE") { res.status(405).json({ error: "Method not allowed" }); return; }

    if (!await verifyAdmin(req, res)) return;

    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId es obligatorio" }); return; }

    try {
      // Obtener datos del proyecto
      const projectDoc = await db.collection("projects").doc(projectId).get();
      if (!projectDoc.exists) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

      const projectData = projectDoc.data();
      const clientId = projectData.clientId || null;

      // Eliminar el proyecto
      await db.collection("projects").doc(projectId).delete();

      const clienteEliminado = await eliminarClienteSiSinProyectos(clientId);

      res.json({ success: true, clienteEliminado });
    } catch (e) {
      console.error("eliminarProyecto:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

async function eliminarClienteSiSinProyectos(clientId) {
  if (!clientId) return false;
  const otrosProyectos = await db.collection("projects")
    .where("clientId", "==", clientId)
    .limit(1)
    .get();
  if (!otrosProyectos.empty) return false;
  try {
    await admin.auth().deleteUser(clientId);
  } catch (authErr) {
    if (authErr.code !== "auth/user-not-found") throw authErr;
  }
  await db.collection("users").doc(clientId).delete();
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULED — Notificaciones de vencimiento (diario 8am Colombia)
   - Admin: proyectos con endDate ≤ 7 días
   - Colaborador: fases con fechaEntregaResponsable ≤ 7 días
   ID determinístico → sin duplicados si corre varias veces el mismo día
═══════════════════════════════════════════════════════════════ */
exports.notificarVencimientos = onSchedule(
  { schedule: "0 8 * * *", timeZone: "America/Bogota" },
  async () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dayStr = hoy.toISOString().split("T")[0]; // "YYYY-MM-DD"

    // Obtener UID del admin
    const adminSnap = await db.collection("users")
      .where("email", "==", "admin@hye.com")
      .limit(1).get();
    const adminUid = adminSnap.empty ? null : adminSnap.docs[0].id;

    // Leer todos los proyectos activos (máximo 200)
    const proyectosSnap = await db.collection("projects").limit(200).get();

    for (const docSnap of proyectosSnap.docs) {
      const p = docSnap.data();
      const projectId = docSnap.id;
      const projectName = p.name || p.nombre || "Proyecto";
      const status = (p.status || "").toLowerCase();

      if (["archivado", "finalizado", "completado"].includes(status)) continue;

      // ── Vencimiento del proyecto → admin ──────────────────────
      if (adminUid) {
        const endDate = parseDateValue(p.endDate || p.fechaFin);
        if (endDate) {
          const dias = Math.round((endDate - hoy) / 86400000);
          if (dias >= 0 && dias <= 7) {
            const label = dias === 0 ? "hoy" : `en ${dias} día${dias > 1 ? "s" : ""}`;
            await createDeadlineNotif(adminUid, `deadline_proj_${projectId}_${dayStr}`, {
              type: "deadline_project",
              title: "⏰ Proyecto próximo a vencer",
              body: `"${projectName}" vence ${label}.`,
              projectId,
              projectName,
              phaseId: "",
              phaseName: "",
            });
          }
        }
      }

      // ── Vencimiento de fase → colaborador responsable ─────────
      const fases = Array.isArray(p.fases) ? p.fases : [];
      for (const fase of fases) {
        const uid = fase.responsableUID || fase.responsable || null;
        if (!uid || !fase.fechaEntregaResponsable) continue;

        const fechaFase = parseDateValue(fase.fechaEntregaResponsable);
        if (!fechaFase) continue;

        const dias = Math.round((fechaFase - hoy) / 86400000);
        if (dias >= 0 && dias <= 7) {
          const label = dias === 0 ? "hoy" : `en ${dias} día${dias > 1 ? "s" : ""}`;
          const faseId = fase.id || fase.nombre || "fase";
          await createDeadlineNotif(uid, `deadline_fase_${projectId}_${faseId}_${dayStr}`, {
            type: "deadline_fase",
            title: "⏰ Tarea próxima a vencer",
            body: `"${fase.nombre || "Fase"}" en ${projectName} vence ${label}.`,
            projectId,
            projectName,
            phaseId: fase.id || "",
            phaseName: fase.nombre || "",
          });
        }
      }
    }

    console.log(`notificarVencimientos completado — ${dayStr}`);
  }
);

/* Convierte string "YYYY-MM-DD" o Timestamp de Firestore a Date */
function parseDateValue(val) {
  if (!val) return null;
  if (typeof val === "string") {
    const d = new Date(val + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val.toDate === "function") return val.toDate();
  return null;
}

/* Crea/sobreescribe una notificación con ID fijo para evitar duplicados.
   Si ya existe con ese ID del mismo día, solo actualiza. */
async function createDeadlineNotif(uid, notifId, payload) {
  try {
    const ref = db.collection("notifications").doc(uid)
      .collection("items").doc(notifId);
    const existing = await ref.get();
    // Si ya fue leída hoy, no molestar de nuevo
    if (existing.exists && existing.data().read) return;
    await ref.set({
      ...payload,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Push solo si no existía antes (primera vez del día)
    if (!existing.exists) {
      await sendPushToUser(uid, payload);
    }
  } catch (e) {
    console.error("createDeadlineNotif:", e);
  }
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

async function verifyAdmin(req, res) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) { res.status(401).json({ error: "No autorizado" }); return false; }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const callerDoc = await db.collection("users").doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
      res.status(403).json({ error: "Acción reservada para el administrador" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Token inválido" });
    return false;
  }
}

async function notifyUser(uid, payload) {
  return Promise.all([
    sendPushToUser(uid, payload),
    createInAppNotification(uid, payload),
  ]);
}

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
    return snap.docs
      .map(d => ({ token: d.data().token, platform: d.data().platform || "web" }))
      .filter(t => Boolean(t.token));
  } catch (e) {
    console.error("getUserTokens:", e);
    return [];
  }
}

async function sendPushToUser(userId, payload) {
  const tokenDocs = await getUserTokens(userId);
  if (tokenDocs.length === 0) {
    console.log(`${userId} sin tokens FCM.`);
    return;
  }

  const dataPayload = toStrings({
    title: payload.title || "H&E Arquitectos",
    body: payload.body || "",
    type: payload.type || "general",
    projectId: payload.projectId || "",
    projectName: payload.projectName || "",
    phaseId: payload.phaseId || "",
    phaseName: payload.phaseName || "",
  });

  const link = payload.projectId
    ? `https://hye-tesis.web.app/mis-proyectos/${payload.projectId}`
    : "https://hye-tesis.web.app";

  const allTokens = tokenDocs.map(t => t.token);

  try {
    const messages = tokenDocs.map(({ token, platform }) => {
      const base = { token, data: dataPayload };

      if (platform === "android") {
        // Android nativo: FCM muestra la notificación automáticamente en background
        return {
          ...base,
          notification: {
            title: payload.title || "H&E Arquitectos",
            body: payload.body || "",
          },
          android: {
            notification: {
              icon: "ic_notification",
              color: "#141414",
              sound: "default",
              clickAction: "FLUTTER_NOTIFICATION_CLICK",
            },
          },
        };
      }

      // Web/PWA: solo data — el service worker muestra la notificación
      return {
        ...base,
        webpush: {
          fcmOptions: { link },
        },
      };
    });

    const results = await Promise.allSettled(
      messages.map(m => messaging.send(m))
    );

    let successCount = 0;
    let failureCount = 0;
    const invalid = new Set([
      "messaging/invalid-registration-token",
      "messaging/registration-token-not-registered",
    ]);
    const batch = db.batch();
    let cleaned = 0;

    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failureCount++;
        const code = result.reason?.errorInfo?.code;
        if (invalid.has(code)) {
          batch.delete(
            db.collection("users").doc(userId)
              .collection("fcmTokens").doc(allTokens[i])
          );
          cleaned++;
        }
      }
    });

    if (cleaned > 0) await batch.commit();
    console.log(`Push → ${userId}: ${successCount} ok, ${failureCount} fallidos (${cleaned} limpiados)`);
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

/**
 * Envía email de confirmación al prospecto cuando crea una solicitud
 */
async function sendEmailConfirmacionSolicitud(solicitud) {
  try {
    if (!solicitud.email) {
      console.log("No se pudo enviar email — falta dirección de correo");
      return;
    }

    const transporter = getTransporter();
    const nombre = solicitud.nombre?.split(" ")[0] || "Prospecto";
    const tipoObra = solicitud.tipoObra || "tu proyecto";

    const mailOptions = {
      from: `"H&E Arquitectos" <${process.env.GMAIL_USER}>`,
      to: solicitud.email,
      subject: "✅ Solicitud recibida — H&E Arquitectos",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #141414; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">¡Gracias por contactarnos!</h1>
          </div>
          
          <div style="padding: 30px; background: #F2EEE7;">
            <p>Hola <strong>${nombre}</strong>,</p>
            
            <p>Hemos recibido tu solicitud de cotización para <strong>${tipoObra}</strong>.</p>
            
            <p>Nuestro equipo revisará la información y nos pondremos en contacto contigo dentro de las próximas 24 horas al número <strong>${solicitud.telefono || "teléfono que proporcionaste"}</strong> o a este correo.</p>
            
            <div style="background: white; border-left: 4px solid #141414; padding: 15px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Tipo de obra:</strong> ${tipoObra}</p>
              <p style="margin: 5px 0;"><strong>Ciudad:</strong> ${solicitud.ciudad || "No especificada"}</p>
              <p style="margin: 5px 0;"><strong>Presupuesto:</strong> ${solicitud.presupuesto || "Por definir"}</p>
            </div>
            
            <p>Si tienes alguna pregunta mientras esperas nuestra respuesta, no dudes en escribirnos.</p>
            
            <p style="margin-top: 30px; color: #999; font-size: 12px;">
              <strong>H&E Arquitectos</strong><br>
              Bogotá, Colombia<br>
              <a href="mailto:contacto@hyearquitectos.com" style="color: #141414; text-decoration: none;">contacto@hyearquitectos.com</a>
            </p>
          </div>
        </div>
      `,
      text: `
Hola ${nombre},

Hemos recibido tu solicitud de cotización para ${tipoObra}.

Nuestro equipo revisará la información y nos pondremos en contacto contigo dentro de las próximas 24 horas.

Tipo de obra: ${tipoObra}
Ciudad: ${solicitud.ciudad || "No especificada"}
Presupuesto: ${solicitud.presupuesto || "Por definir"}

H&E Arquitectos
Bogotá, Colombia
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmación enviado a ${solicitud.email}`);
  } catch (error) {
    console.error("❌ Error enviando email de confirmación:", error.message);
  }
}