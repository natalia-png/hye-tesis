# Manual de Mantenimiento de la App H&E Arquitectos

## 1. Propósito del documento

Este manual sirve como guía de continuidad para futuros desarrolladores de la plataforma H&E Arquitectos. Su objetivo es explicar cómo está construida la solución, cómo se despliega la versión web, cómo se genera la APK Android y qué aspectos deben cuidarse para mantener la app estable en el tiempo.

El documento está basado en la configuración real del repositorio a la fecha y debe actualizarse cada vez que cambien procesos de build, despliegue, dominio, credenciales, reglas o estructura del proyecto.

## 2. Resumen de la solución

La plataforma está compuesta por:

- Frontend web en React + Vite.
- Persistencia y autenticación en Firebase.
- Cloud Functions para automatizaciones y notificaciones.
- Firebase Hosting para servir la app web.
- Firebase Cloud Messaging para notificaciones push.
- Empaquetado móvil Android con Capacitor.

## 3. Estructura del repositorio

- `frontend/vite-project/`: aplicación principal.
- `frontend/vite-project/src/`: código fuente del frontend.
- `frontend/vite-project/functions/`: Cloud Functions de Firebase.
- `frontend/vite-project/android/`: proyecto Android generado por Capacitor.
- `frontend/vite-project/firebase.json`: configuración de Hosting, Functions, Firestore y Storage.
- `frontend/vite-project/firestore.rules`: reglas de Firestore.
- `frontend/vite-project/storage.rules`: reglas de Storage.
- `backend/`: backend alterno en Express. No es el canal principal de despliegue de la app web actual.
- `docs/`: documentación del proyecto.

## 4. Tecnologías principales

- React 19
- Vite 7
- Firebase Auth
- Firestore
- Firebase Storage
- Firebase Hosting
- Firebase Cloud Functions con Node.js 20
- Capacitor 8 para Android
- ESLint para control de calidad

## 5. Proyecto Firebase actual

La app está enlazada actualmente al proyecto:

- Proyecto Firebase: `hye-tesis`
- Sitio Hosting por defecto: `hye-tesis`
- URL pública actual: `https://hye-tesis.web.app`

Esto se confirma en:

- `frontend/vite-project/.firebaserc`
- `frontend/vite-project/firebase.json`
- referencias internas del frontend y functions

Si existe un dominio personalizado adicional, debe verificarse directamente en la consola de Firebase Hosting. En este repositorio no hay una referencia explícita de DNS o dominio propio distinto a `hye-tesis.web.app`.

## 6. Variables y configuración sensible

La configuración Firebase del frontend se toma desde variables de entorno definidas en Vite:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

Estas variables son usadas en:

- `frontend/vite-project/src/lib/firebase.js`

Recomendaciones:

- No hardcodear nuevas credenciales en el código.
- Mantener un `.env.example` con nombres de variables, sin valores reales.
- Verificar que el entorno de build de producción tenga estos valores correctos antes de desplegar.

## 7. Instalación local

Desde `frontend/vite-project/`:

```powershell
npm install
```

Para correr en desarrollo:

```powershell
npm run dev
```

Para compilar producción:

```powershell
npm run build
```

Para revisar lint:

```powershell
npm run lint
```

Para pruebas:

```powershell
npm run test
```

## 8. Build web de producción

La compilación web se genera con:

```powershell
npm run build
```

Esto crea la carpeta:

- `frontend/vite-project/dist/`

Según `firebase.json`, Firebase Hosting publica exactamente esa carpeta:

- `"public": "dist"`

La app usa rewrite total a `index.html`, lo cual permite el enrutamiento SPA de React Router:

```json
"rewrites": [
  {
    "source": "**",
    "destination": "/index.html"
  }
]
```

## 9. Despliegue del frontend a Firebase Hosting

Proceso recomendado:

1. Entrar a `frontend/vite-project/`
2. Instalar dependencias si hace falta
3. Ejecutar lint
4. Ejecutar build
5. Desplegar Hosting

Comandos:

```powershell
cd frontend\vite-project
npm install
npm run lint
npm run build
firebase deploy --only hosting
```

Notas:

- El despliegue usa el proyecto por defecto `hye-tesis`.
- El sitio público actual es `https://hye-tesis.web.app`.
- Si en el futuro se agregan canales preview, conviene documentarlos aparte.

## 10. Despliegue de Cloud Functions

Las functions viven en:

- `frontend/vite-project/functions/`

El runtime configurado es:

- Node.js 20

Despliegue:

```powershell
cd frontend\vite-project\functions
npm install
cd ..
firebase deploy --only functions
```

También existe script local en `functions/package.json`:

```powershell
npm run deploy
```

Uso recomendado:

- Desplegar functions cuando haya cambios en triggers, notificaciones, correos o lógica backend de Firebase.
- No desplegar functions sin validar impacto en notificaciones, correos y automatizaciones programadas.

## 11. Firestore y Storage Rules

Archivos principales:

- `frontend/vite-project/firestore.rules`
- `frontend/vite-project/storage.rules`

Cuando se modifiquen reglas:

```powershell
cd frontend\vite-project
firebase deploy --only firestore:rules,storage
```

Antes de desplegar reglas:

- validar que admin, colaborador y cliente mantengan acceso correcto
- probar lectura y escritura de notificaciones
- probar subida de archivos
- probar visibilidad de archivos para cliente

## 12. Generación de la APK Android

La app Android está construida con Capacitor sobre la versión web compilada.

### 12.1 Configuración base

Archivo:

- `frontend/vite-project/capacitor.config.json`

Valores actuales:

- `appId`: `com.hye.app`
- `appName`: `H&E Arquitectos`
- `webDir`: `dist`

Importante:

- El `applicationId` real del build Android en Gradle es `com.hye.arquitectos`.
- Si se cambia el identificador del paquete, debe revisarse Capacitor, Gradle, Firebase Android y notificaciones.

### 12.2 Flujo para regenerar la app Android

Desde `frontend/vite-project/`:

```powershell
npm run build
npx cap sync android
```

El `sync` copia el contenido actualizado de `dist` al proyecto Android y sincroniza plugins de Capacitor.

### 12.3 Generación del APK release

Dentro de:

- `frontend/vite-project/android/`

Comando típico:

```powershell
.\gradlew.bat assembleRelease
```

El APK release queda normalmente en:

- `frontend/vite-project/android/app/build/outputs/apk/release/`

Además, en `android/app/build.gradle` se configuró un nombre personalizado para el archivo release:

- `HYE-Arquitectos-v1.0-release-final.apk`

### 12.4 Requisitos para que la APK funcione correctamente

- Haber ejecutado antes `npm run build`
- Haber ejecutado `npx cap sync android`
- Tener `google-services.json` en `android/app/` si se usan push notifications
- Tener Android SDK y Gradle funcionales
- Tener el keystore correcto para firma release

## 13. Firma del APK y advertencia importante

Actualmente `android/app/build.gradle` contiene configuración de firma release hardcodeada, incluyendo:

- ruta del keystore
- `storePassword`
- `keyAlias`
- `keyPassword`

Esto es un riesgo de seguridad y mantenimiento.

Recomendación obligatoria a futuro:

1. Mover estas credenciales a `gradle.properties` local o variables de entorno.
2. No dejar contraseñas en el repositorio.
3. Guardar el keystore en un lugar seguro y respaldado.
4. Registrar quién custodia el keystore de producción.

Sin el keystore original de publicación, no se podrán emitir actualizaciones firmadas de la misma app Android.

## 14. Hosting y dominio

Estado actual conocido:

- Hosting en Firebase Hosting
- Sitio por defecto: `hye-tesis`
- URL pública actual: `https://hye-tesis.web.app`

Si en el futuro se usa dominio personalizado:

1. ingresar a Firebase Console
2. abrir Hosting
3. revisar dominios conectados
4. validar DNS del proveedor del dominio
5. confirmar emisión de certificados SSL

Buenas prácticas:

- No cambiar dominio principal sin revisar CORS, links absolutos, push y correos.
- Buscar en el código cualquier referencia fija a `https://hye-tesis.web.app`.

Actualmente hay referencias explícitas al dominio en:

- `frontend/vite-project/src/pages/ComercialAdmin.jsx`
- `frontend/vite-project/functions/index.js`
- `backend/src/index.js`

Si se cambia el dominio, deben revisarse esos puntos.

## 15. Notificaciones push

La app usa Firebase Cloud Messaging.

Puntos relevantes:

- En web, la lógica vive en hooks y service worker.
- En Android, el manifiesto declara permisos y configuración de icono/color de notificación.
- `google-services.json` es necesario para Android nativo.

Archivos importantes:

- `frontend/vite-project/src/hooks/usePushNotifications.js`
- `frontend/vite-project/src/hooks/useNotifications.js`
- `frontend/vite-project/public/manifest.webmanifest`
- `frontend/vite-project/android/app/src/main/AndroidManifest.xml`
- `frontend/vite-project/functions/index.js`

Al modificar notificaciones, probar:

- recepción web con app abierta
- recepción web con app cerrada
- recepción Android
- creación de notificación in-app en Firestore

## 16. Backend alterno en carpeta `backend/`

Existe un backend en Express dentro de `backend/`, pero la arquitectura principal desplegable de la plataforma está apoyada en Firebase Hosting + Firebase Functions.

El backend alterno:

- usa Express
- tiene CORS limitado a `https://hye-tesis.web.app` y `http://localhost:5173`
- no parece ser el punto principal de despliegue de la app actual

Antes de usarlo en producción:

- revisar si sigue vigente
- validar dependencias
- confirmar dónde está hospedado
- confirmar si aún participa en flujo de notificaciones o integraciones

## 17. Checklist antes de tocar producción

Antes de desplegar cualquier cambio:

1. ejecutar `npm run lint`
2. ejecutar `npm run build`
3. validar visualmente la funcionalidad cambiada
4. revisar si el cambio afecta roles
5. revisar si afecta rutas protegidas
6. revisar si afecta rules de Firestore o Storage
7. revisar si afecta functions
8. revisar si afecta Android o push notifications

## 18. Checklist antes de generar una nueva APK

1. actualizar código web
2. ejecutar lint
3. ejecutar build
4. ejecutar `npx cap sync android`
5. abrir Android Studio o ejecutar Gradle release
6. validar login
7. validar navegación base
8. validar subida de archivos
9. validar notificaciones si aplica
10. firmar con el keystore correcto

## 19. Mantenimiento preventivo recomendado

- Actualizar dependencias en ventanas controladas, no mezclado con cambios funcionales.
- Revisar al menos una vez por ciclo académico/lanzamiento:
  - versión de Node usada por functions
  - versiones de Capacitor
  - reglas de Firestore y Storage
  - vigencia de credenciales y keystore
  - enlaces absolutos al dominio
  - estado del proyecto Firebase
- Mantener un respaldo del keystore y de las credenciales críticas fuera del repositorio.

## 20. Riesgos conocidos y deuda técnica

- Credenciales de firma Android actualmente hardcodeadas en `build.gradle`.
- Referencias absolutas al dominio `hye-tesis.web.app` repartidas en varios archivos.
- Existe carpeta `backend/` que puede generar confusión si no se define su rol oficial.
- No hay aún un `.env.example` completo para reconstruir el entorno rápidamente.

## 21. Recomendaciones para futuros desarrolladores

- Antes de modificar algo, identificar si el cambio es solo frontend o también impacta Firebase, Functions, reglas o Android.
- No editar manualmente archivos generados dentro de `android/app/build/` o `dist/`.
- Documentar cualquier nuevo proceso de despliegue en este mismo manual.
- Si se cambia una configuración crítica, actualizar también:
  - este manual
  - la documentación funcional
  - los scripts del proyecto

## 22. Comandos rápidos de referencia

### Frontend

```powershell
cd frontend\vite-project
npm install
npm run dev
npm run lint
npm run build
firebase deploy --only hosting
```

### Functions

```powershell
cd frontend\vite-project\functions
npm install
cd ..
firebase deploy --only functions
```

### Reglas

```powershell
cd frontend\vite-project
firebase deploy --only firestore:rules,storage
```

### Android APK

```powershell
cd frontend\vite-project
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleRelease
```

## 23. Ubicación recomendada para futuras ampliaciones del manual

Si el proyecto sigue creciendo, se recomienda separar este manual en:

- mantenimiento general
- despliegue web
- despliegue móvil
- administración Firebase
- operación funcional por rol

Mientras tanto, este archivo funciona como guía única de continuidad técnica.
