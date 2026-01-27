// src/lib/firestore.js
import { db } from "./firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";

export async function fetchUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ✅ Buscar UID de usuario por email (para asignar cliente sin usar UID)
export async function findUserByEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return null;

  const col = collection(db, "users");
  const q = query(col, where("email", "==", clean), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}
