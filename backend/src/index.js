// backend/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { messaging } from "./firebaseAdmin.js"; // Importar nuestro firebase-admin
import { sendNotificationToUser } from "./services/notificationService.js"; // Importar nuevo servicio

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API Plataforma Arquitectónica funcionando 🚀");
});

// Endpoint de prueba temporal para forzar un evento de notificación al Cliente
app.post("/api/notifications/test-event", async (req, res) => {
  const { userId, title, body, data } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ error: "Faltan datos: userId, title y body son obligatorios." });
  }

  try {
    // Usamos el nuevo servicio, que se encargará de buscar todos los tokens
    // almacenados bajo el `userId` y enviará el Push.
    await sendNotificationToUser(userId, title, body, data || {});

    res.status(200).json({ success: true, message: `Notificación enviada a todos los dispositivos de ${userId}` });
  } catch (error) {
    console.error("Error al disparar el evento de prueba:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint básico manual
app.post("/api/notifications/send", async (req, res) => {
  const { token, title, body, data } = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({ error: "Faltan datos: token, title y body son obligatorios." });
  }

  try {
    const payload = {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: data || {}, // Puedes mandar info extra personalizada
    };

    const response = await messaging.send(payload);
    res.status(200).json({ success: true, message: "Notificación enviada", messageId: response });
  } catch (error) {
    console.error("Error al enviar notificación:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(4000, () => {
  console.log("Servidor backend en http://localhost:4000");
});
