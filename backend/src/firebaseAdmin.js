import admin from "firebase-admin";

// NOTA: Para inicializar la app en el servidor de forma segura se usa
// una Cuenta de Servicio. Puedes descargar el JSON en la consola de Firebase
// (Project Settings > Service Accounts > Generate New Private Key).

// Luego de descargar ese archivo .json, puedes cargarlo directamente así:
// import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };
// 
// o bien mediante variables de entorno si vas a alojarlo en producción.
// Por defecto se busca la variable GOOGLE_APPLICATION_CREDENTIALS.

if (!admin.apps.length) {
  admin.initializeApp({
    // Si tienes el archivo local, descomenta la siguiente línea y elimina applicationDefault()
    // credential: admin.credential.cert(serviceAccount),
    credential: admin.credential.applicationDefault()
  });
}

export const messaging = admin.messaging();
