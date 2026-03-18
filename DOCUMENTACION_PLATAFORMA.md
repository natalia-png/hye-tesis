# Plataforma H&E Arquitectos — Documentación funcional

## Resumen ejecutivo

Plataforma web para la gestión integral de proyectos arquitectónicos de H&E Arquitectos. Conecta tres roles principales (Admin, Colaborador, Cliente) y ofrece control de fases, gestión documental, notificaciones (push / in‑app / email), módulo comercial, gestión de garantías y un asistente IA. La solución prioriza la colaboración, trazabilidad y comunicación eficiente entre equipo y clientes.

---

## Objetivos del sistema

- Centralizar la gestión de proyectos arquitectónicos y su documentación.
- Mantener comunicación proactiva con clientes mediante notificaciones y correos.
- Automatizar alertas relevantes para evitar retrasos y pérdida de información.
- Proveer reportes exportables y un historial claro de hitos y garantías.
- Facilitar el trabajo colaborativo entre áreas (jurídica, sistemas, arquitectura).

---

**Arquitectura (alto nivel)**

- Frontend: Aplicación React (Vite) — interfaz responsive y roles protegidos.
- Backend / Automatizaciones: Cloud Functions / Firebase Admin para triggers, notificaciones y envíos de correo.
- Persistencia: Firestore (proyectos, fases, notificaciones, garantías, solicitudes comerciales).
- Almacenamiento de archivos: Firebase Storage (archivos por fase, evidencias de garantías).
- Mensajería: Firebase Cloud Messaging para push; in‑app notifications en Firestore.
- IA: Firebase AI Logic (modelo Gemini) para asistente contextual.
- Hosting y despliegue: Firebase Hosting + Cloud Functions.

---

**Roles y permisos**

- Admin (`admin`): Control total. Crear/editar proyectos, gestionar colaboradores, ver historial, responder garantías, gestionar módulo comercial y generar reportes.
- Colaborador (`colaborador`): Acceso a lista de proyectos, gestionar fases asignadas, subir archivos y notas, participar en garantías (según subRol: jurídica, sistemas, arquitecto).
- Cliente (`cliente`): Acceso limitado a `mis-proyectos`, ver fases y archivos publicados, crear solicitudes de garantía y visualizar reportes específicos.

La interfaz protege rutas y vistas según rol; las reglas de Firestore restringen acceso a documentos sensibles por `uid`/rol.

---

**Funcionalidades principales**

1. Gestión de Proyectos
   - Crear y editar proyectos con metadatos (nombre, cliente, fechas, presupuesto, ubicación, equipo responsable).
   - Panel de lista y filtros por estado, cliente, fechas.

2. Fases del proyecto
   - Plantilla de fases por proyecto; cada fase tiene nombre, porcentaje de avance, estado (pendiente, en curso, completada), responsable, notas y archivos.
   - Cálculo automático del avance global del proyecto a partir de las fases.

3. Documentos y archivos
   - Subida y almacenamiento en la nube; control de visibilidad `visibleToClient` para publicar documentos al cliente.
   - Versionado básico y descarga de evidencias.

4. Notas y bitácora
   - Registro de notas por fase con autor y timestamp; historial accesible en la vista de detalle.

5. Garantías y posventa
   - Clientes pueden crear solicitudes de garantía con descripción, fotos y prioridad.
   - Admin/colaborador responden con texto o archivo; el cliente recibe notificación cuando hay respuesta.

6. Módulo Comercial
   - Formulario público de `Solicitud de servicio` para prospectos, almacenado en `solicitudesComerciales`.
   - Admin revisa y cambia el estado (aprobada/rechazada) y envía respuesta por correo al prospecto.

7. Asistente IA
   - Bot contextual (Gemini) disponible en la interfaz: ofrece resúmenes de proyectos, ayuda por rol y respuestas concisas en español.

8. Reportes y exportación
   - Generación de PDF (resumen del proyecto, fases y timeline) y exportación CSV para análisis externo.

---

**Notificaciones — canales y triggers**

Canales:
- Push (FCM): mensajería a dispositivos móviles y navegadores (tokens almacenados por usuario).
- In‑app: registros en Firestore (`notifications/{uid}/items/{id}`) para historial dentro de la plataforma.
- Email: mensajes transaccionales (confirmación de solicitud comercial, respuesta a garantías) enviados por backend.

Eventos / triggers principales:
- Nueva nota en fase → notificar al cliente (tipo: `new_note`).
- Archivo publicado al cliente (visible) → notificar al cliente (tipo: `new_file`).
- Avance de fase significativo (ej. +25%) → notificar progreso al cliente y responsable (tipo: `progress_update`).
- Nueva solicitud de garantía → notificar admin (tipo: `nueva_garantia`).
- Respuesta a garantía → notificar cliente (tipo: `garantia_respondida`).
- Nueva solicitud comercial → notificar admin (tipo: `nueva_solicitud_comercial`).
- Cambio de estado de solicitud comercial (`aprobada`/`rechazada`) → enviar correo al prospecto.

Payload mínimo de notificación: `type`, `title`, `body`, `projectId`, `projectName`, `phaseId`, `phaseName`.

Comportamiento esperado:
- Los envíos push se realizan en multicast (varios tokens por usuario). Se registran respuestas y se eliminan tokens inválidos.
- Las notificaciones web incluyen enlaces que llevan a la vista relevante del proyecto/fase.

---

**Tipos de reportes**

1. Reporte de Proyecto (PDF)
   - Contenido: datos generales del proyecto, avance global, lista de fases con porcentaje, responsables, fechas planificadas y reales, resumen de archivos y notas.
   - Uso: entrega a cliente, archivo interno.

2. Reporte de Fases / Timeline
   - Contenido: Gantt simplificado o lista ordenada con fecha planificada vs fecha real por fase, duración real, retrasos.
   - Uso: gestión de hitos, análisis de desvíos.

3. Dashboard KPI
   - Métricas: proyectos activos, promedio de avance, fases retrasadas, solicitudes de garantía abiertas, tiempo medio de resolución.

4. Historial / Auditoría
   - Cambios clave: quien hizo la acción, qué modificó, cuándo.
   - Uso: cumplimiento y seguimiento interno.

5. Reporte Comercial
   - Listado de `solicitudesComerciales` con estado, contacto y notas del admin.

Export formats: PDF y CSV (para análisis externos).

---

**Cronograma: Real vs App (definición y visualización)**

Conceptos clave:
- `fechaPlanInicio`, `fechaPlanFin`: fechas planificadas por fase.
- `startDateReal`, `endDateReal`: fechas reales cuando la fase comienza/completa.
- `porcentaje`: avance actual de la fase (0–100).
- `duracionPlan` = `fechaPlanFin - fechaPlanInicio`.
- `duracionReal` = `endDateReal - startDateReal`.
- `deltaDays` = `endDateReal - fechaPlanFin` (positivo = retraso).

Cálculo de avance global:
- La app calcula un `avanceGlobal` basado en los porcentajes de las fases (actualmente promedio simple de fases). Se puede ponderar por importancia si se requiere.

Visualización:
- Barra de progreso por fase y del proyecto.
- Comparativa `Plan vs Real`: gráficos de barras o líneas en `PhaseTimeline` y `PhaseDonut` que muestran porcentaje planificado vs real y fechas.
- Indicadores: coloración por estado (on-time = verde, en riesgo = ámbar, retrasado = rojo).

Reglas y alertas automáticas:
- Si `porcentaje` aumenta >= 25% → notificar `progress_update`.
- Si `endDateReal` supera `fechaPlanFin` → marcar retraso y generar alerta/report.
- Cuando `porcentaje` alcanza 100% → marcar fase completada y notificar a stakeholders.

---

**Modelo de datos (resumen conceptual)**

- `users/{uid}`: perfil (nombre, email, role, subRole) y subcolección `fcmTokens`.
- `projects/{projectId}`: { name, clientId/clientEmail, fases: [], startDate, endDate, progressReal, metadata }.
- `projects/{projectId}/fases`: cada fase con { id, nombre, porcentaje, estado, responsableUid, fechaPlanInicio, fechaPlanFin, startDateReal, endDateReal, notas, archivos }.
- `garantias/{projectId}/solicitudes/{solicitudId}`: solicitudes de posventa con estado, pruebas (fotos), creador y respuestas.
- `solicitudesComerciales/{id}`: prospectos con datos de contacto, estado y notas administrativas.
- `notifications/{uid}/items/{id}`: notificaciones in‑app.

---

**Integraciones y consideraciones técnicas**

- Email transaccional: actualmente mediante `nodemailer` / SMTP (Gmail). Recomendado: usar Secret Manager para credenciales o migrar a proveedor transaccional (SendGrid/Mailgun) para mayor estabilidad.
- Mensajería push: FCM (multiplataforma). Mantener limpieza de tokens inválidos para evitar costes y errores repetidos.
- IA: el asistente Gemini se usa solo para respuestas contextuales; controlar quotas y prompts para evitar coste excesivo.

---

**Operaciones y despliegue**

- Al usar Secret Manager o `--set-secrets` durante despliegue, las credenciales se mantienen asociadas a la función y no se pierden con redeploys.
- Revisar logs en Cloud Functions para errores (ej. `Invalid login 535` en SMTP) y proteger la información sensible en los logs.
- Backups: exportar datos críticos periódicamente o configurar exportación de Firestore según necesidad.
- Monitorización: activar alertas por errores críticos y por aumento de latencia o fallos en funciones.

---

**Seguridad y privacidad**

- Reglas estrictas de Firestore por `uid` y rol.
- No almacenar credenciales en código; usar Secret Manager.
- Revisar consentimiento / políticas de datos para clientes al almacenar y compartir información del proyecto.

---

**Recomendaciones / mejoras futuras**

- Migrar envío de emails a un servicio transaccional con entrega y métricas (SendGrid, Mailgun, Amazon SES).
- Implementar OAuth2 para Gmail si se mantiene SMTP directo (evitar contraseñas de app si se desea mayor control).
- Añadir un Gantt interactivo con dependencias y reasignación automática de fechas.
- Automatizar alertas por retrasos críticos y crear reportes periódicos (cron) para stakeholders.
- Añadir logs y dashboards de uso para dimensionar cargas y costes.

---

## Contacto técnico

Para dudas sobre implementación o para solicitar cambios en el comportamiento, contactar con el desarrollador responsable o con el equipo de infraestructura de H&E.


---

*Documento generado para incluir en el repositorio y usar como base de la documentación funcional.*
