// src/hooks/useChatMessages.js
// Mensajes en tiempo real de un chat + función de envío
import { useEffect, useState, useCallback } from "react";
import {
  collection, doc, onSnapshot, query, orderBy, limit,
  addDoc, updateDoc, setDoc, serverTimestamp, increment, getDoc,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export function useChatMessages(chatId, currentUid) {
  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState(null);
  const [ready, setReady] = useState(false);

  // Escuchar el documento del chat
  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(doc(db, "chats", chatId), snap => {
      setChat(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [chatId]);

  // Escuchar los mensajes
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(150)
    );
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setReady(true);
    }, () => setReady(true));
  }, [chatId]);

  // Marcar como leído al entrar
  useEffect(() => {
    if (!chatId || !currentUid) return;
    updateDoc(doc(db, "chats", chatId), {
      [`unread.${currentUid}`]: 0,
    }).catch(() => {});
  }, [chatId, currentUid]);

  // Enviar mensaje
  const sendMessage = useCallback(async (text, sender) => {
    if (!text.trim() || !chatId) return;

    // Asegurar que el documento del chat existe
    const chatRef = doc(db, "chats", chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) return; // El chat debe crearse antes de enviar

    const chatData = snap.data();
    const participants = chatData.participants || [];

    // Agregar mensaje
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: text.trim(),
      senderId: sender.uid,
      senderName: sender.name,
      senderRole: sender.role,
      createdAt: serverTimestamp(),
    });

    // Actualizar metadatos + incrementar no leídos de otros participantes
    const recipients = participants.filter(uid => uid !== sender.uid);
    const unreadUpdate = {};
    recipients.forEach(uid => { unreadUpdate[`unread.${uid}`] = increment(1); });

    await updateDoc(chatRef, {
      lastMessage: text.trim().substring(0, 80),
      lastMessageSender: sender.name,
      lastAt: serverTimestamp(),
      // Des-archivar el chat para los receptores cuando llega un nuevo mensaje
      ...(recipients.length > 0 ? { hiddenFor: arrayRemove(...recipients) } : {}),
      ...unreadUpdate,
    });
  }, [chatId]);

  return { messages, chat, ready, sendMessage };
}

// ── Archivar chat (ocultar del inbox; reaparece con nuevo mensaje) ────
export async function archiveChat(chatId, uid) {
  await updateDoc(doc(db, "chats", chatId), { hiddenFor: arrayUnion(uid) });
}

// ── Salir de chat directo (eliminar del inbox permanentemente) ────────
export async function leaveChat(chatId, uid) {
  await updateDoc(doc(db, "chats", chatId), { participants: arrayRemove(uid) });
}

// ── Utilidad: crear/obtener chat de proyecto ──────────────────────────
export async function ensureProjectChat(projectId, projectName, clientId, clientName, adminId, adminName) {
  const chatId = `project_${projectId}`;
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    await setDoc(chatRef, {
      type: "project",
      projectId,
      projectName,
      participants: [clientId, adminId].filter(Boolean),
      participantNames: {
        ...(clientId ? { [clientId]: clientName } : {}),
        ...(adminId ? { [adminId]: adminName } : {}),
      },
      participantRoles: {
        ...(clientId ? { [clientId]: "cliente" } : {}),
        ...(adminId ? { [adminId]: "admin" } : {}),
      },
      unread: {
        ...(clientId ? { [clientId]: 0 } : {}),
        ...(adminId ? { [adminId]: 0 } : {}),
      },
      lastMessage: null,
      lastMessageSender: null,
      lastAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
  return chatId;
}

// ── Utilidad: crear/obtener chat directo entre dos usuarios ───────────
export async function ensureDirectChat(uid1, name1, role1, uid2, name2, role2) {
  const chatId = `direct_${[uid1, uid2].sort().join("_")}`;
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    await setDoc(chatRef, {
      type: "direct",
      projectId: null,
      projectName: null,
      participants: [uid1, uid2],
      participantNames: { [uid1]: name1, [uid2]: name2 },
      participantRoles: { [uid1]: role1, [uid2]: role2 },
      unread: { [uid1]: 0, [uid2]: 0 },
      lastMessage: null,
      lastMessageSender: null,
      lastAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
  return chatId;
}
