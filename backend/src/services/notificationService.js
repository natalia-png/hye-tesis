import admin from 'firebase-admin';
import { messaging } from './firebaseAdmin.js';

// Obtenemos la instancia de Firestore desde firebase-admin
const db = admin.firestore();

/**
 * Función genérica para obtener todos los tokens de un usuario específico
 * Busca en la subcolección `users/{uid}/fcmTokens` de Firestore.
 * @param {string} userId - UID del cliente o administrador
 * @returns {Promise<string[]>} - Array de tokens [ "token1", "token2" ]
 */
const getUserTokens = async (userId) => {
    try {
        const tokensRef = db.collection('users').doc(userId).collection('fcmTokens');
        const snapshot = await tokensRef.get();

        if (snapshot.empty) return [];

        let tokens = [];
        snapshot.forEach(doc => {
            tokens.push(doc.data().token);
        });

        return tokens;
    } catch (error) {
        console.error(`Error al obtener tokens para el usuario ${userId}:`, error);
        return [];
    }
};

/**
 * Función principal que despacha la notificación a todos los dispositivos de un usuario
 * @param {string} userId - A quién enviamos la notificación
 * @param {string} title - Título del mensaje
 * @param {string} body - Cuerpo del mensaje
 * @param {object} data - (Opcional) Datos extra, ej. { projectId: "abc" }
 */
export const sendNotificationToUser = async (userId, title, body, data = {}) => {
    const tokens = await getUserTokens(userId);

    if (tokens.length === 0) {
        console.log(`No se encontraron tokens para el usuario ${userId}`);
        return;
    }

    const payload = {
        tokens: tokens, // 'tokens' plural permite un envío multicast a varios dispositivos
        notification: {
            title,
            body,
        },
        data: data
    };

    try {
        const response = await messaging.sendEachForMulticast(payload);
        console.log(`Notificación enviada a ${userId}: ${response.successCount} exitosas, ${response.failureCount} fallidas.`);

        // Opcional: Podríamos limpiar tokens que ya expiraron si failureCount > 0
        // (response.responses arroja el detalle de cada intento)
    } catch (error) {
        console.error("Error al enviar notificación multicast:", error);
    }
};

// ---------------------------------------------------------
// CASOS DE USO ESPECÍFICOS (Llamar a estos desde tus controladores)
// ---------------------------------------------------------

/**
 * 1. Evento: Cambio de Fase del Proyecto
 */
export const notifyPhaseChange = async (clientId, projectId, projectName, phaseName, newStatus) => {
    const title = `Fase Actualizada en ${projectName}`;
    const body = `La fase "${phaseName}" ahora está: ${newStatus}.`;

    await sendNotificationToUser(clientId, title, body, { type: "phase_change", projectId });
};

/**
 * 2. Evento: Nuevo Archivo Subido
 */
export const notifyNewFile = async (clientId, projectId, projectName, fileName) => {
    const title = `Nuevo archivo en ${projectName}`;
    const body = `Se ha subido el archivo: "${fileName}". Entra para revisarlo.`;

    await sendNotificationToUser(clientId, title, body, { type: "new_file", projectId });
};

/**
 * 3. Evento: Nueva Nota Agregada
 */
export const notifyNewNote = async (targetUserId, projectId, projectName) => {
    const title = `Nueva actualización en bitácora`;
    const body = `Se ha agregado una nueva nota al proyecto ${projectName}.`;

    await sendNotificationToUser(targetUserId, title, body, { type: "new_note", projectId });
};

/**
 * 4. Evento: Proyecto Completado/Finalizado
 */
export const notifyProjectCompleted = async (clientId, projectId, projectName) => {
    const title = `¡Proyecto Finalizado! 🎉`;
    const body = `Tu proyecto "${projectName}" se ha marcado como completado. ¡Gracias por confiar en H&E!`;

    await sendNotificationToUser(clientId, title, body, { type: "project_completed", projectId });
};
