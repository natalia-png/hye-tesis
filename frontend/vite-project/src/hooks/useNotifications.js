// src/hooks/useNotifications.js
// Lee las notificaciones del usuario en tiempo real
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, orderBy, query,
  limit, writeBatch, doc, where, getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export function useNotifications(uid) {
  const [items, setItems]     = useState([]);
  const [unread, setUnread]   = useState(0);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    if (!uid) { setItems([]); setUnread(0); setReady(true); return; }

    const ref = collection(db, "notifications", uid, "items");
    const qs  = query(ref, orderBy("createdAt", "desc"), limit(30));

    const unsub = onSnapshot(qs, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(list);
      setUnread(list.filter(n => !n.read).length);
      setReady(true);
    }, err => {
      console.error("useNotifications:", err);
      setReady(true);
    });

    return () => unsub();
  }, [uid]);

  // Marca todas como leídas
  const markAllRead = useCallback(async () => {
    if (!uid || unread === 0) return;
    try {
      const ref  = collection(db, "notifications", uid, "items");
      const snap = await getDocs(query(ref, where("read", "==", false), limit(30)));
      if (snap.empty) return;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(doc(db, "notifications", uid, "items", d.id), { read: true }));
      await batch.commit();
    } catch (e) {
      console.error("markAllRead:", e);
    }
  }, [uid, unread]);

  // Marca una como leída
  const markRead = useCallback(async (notifId) => {
    if (!uid || !notifId) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "notifications", uid, "items", notifId), { read: true });
      await batch.commit();
    } catch (e) {
      console.error("markRead:", e);
    }
  }, [uid]);

  return { items, unread, ready, markAllRead, markRead };
}