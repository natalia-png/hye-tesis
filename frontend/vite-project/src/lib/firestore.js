// src/lib/firestore.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function fetchUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
