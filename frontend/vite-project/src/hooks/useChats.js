// src/hooks/useChats.js
// Lista en tiempo real de todos los chats del usuario con conteo de no leídos
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useChats(uid) {
  const [chats, setChats] = useState([]);
  const [archivedChats, setArchivedChats] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) { setChats([]); setArchivedChats([]); setUnreadTotal(0); setReady(true); return; }

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      limit(50)
    );

    const unsub = onSnapshot(q, snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0));

      const active = all.filter(c => !(c.hiddenFor || []).includes(uid));
      const archived = all.filter(c => (c.hiddenFor || []).includes(uid));

      setChats(active);
      setArchivedChats(archived);
      const total = active.reduce((acc, c) => acc + (c.unread?.[uid] || 0), 0);
      setUnreadTotal(Math.min(total, 99));
      setReady(true);
    }, () => {
      setReady(true);
    });

    return () => { try { unsub(); } catch (_e) { /* Firebase 12.9 race on unmount */ } };
  }, [uid]);

  return { chats, archivedChats, unreadTotal, ready };
}
