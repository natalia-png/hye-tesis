// src/hooks/useReportePDF.js
// Reporte ejecutivo PDF — H&E Arquitectos
// Descarga nativa en APK (Capacitor Filesystem + Share) y web (doc.save)

import { useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// ── Paleta H&E ───────────────────────────────────────────────
const C = {
    ink:        [30,  27,  24],
    taupe:      [139, 125, 107],
    sand:       [245, 240, 230],
    sandDark:   [230, 223, 210],
    white:      [255, 255, 255],
    completada: [74,  124, 89],
    en_curso:   [201, 160, 56],
    pendiente:  [180, 173, 160],
    accent:     [101, 87,  68],
};

const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ════════════════════════════════════════════════════════════
export function useReportePDF() {
    const [loading, setLoading] = useState(false);

    const generar = async (proyecto, isAdmin = false) => {
        setLoading(true);
        try {
            const fasesConDatos = await cargarDatosFases(
                proyecto.id,
                proyecto.fases || [],
                isAdmin
            );

            const doc = new jsPDF({ unit: "mm", format: "a4" });
            const checkPage = (y, needed = 15) => checkPageInDoc(doc, y, needed);

            // ── Portada ─────────────────────────────────────
            await renderPortada(doc, proyecto);

            // ── Página 2: contenido ─────────────────────────
            doc.addPage();
            let y = MARGIN;

            y = renderResumenEjecutivo(doc, proyecto, fasesConDatos, isAdmin, y, checkPage);
            y = renderSeccionFases(doc, fasesConDatos, y, checkPage);

            renderPiePaginas(doc);

            // ── Descargar ───────────────────────────────────
            const nombreArchivo = `Reporte-${(proyecto.name || proyecto.nombre || "Proyecto")
                .replaceAll(/\s+/g, "-")
                .replaceAll(/[^a-zA-Z0-9-]/g, "")}-${new Date().toISOString().slice(0, 10)}.pdf`;

            if (Capacitor.isNativePlatform()) {
                // APK: guardar en cache y compartir
                const base64 = doc.output("datauristring").split(",")[1];
                const saved = await Filesystem.writeFile({
                    path: nombreArchivo,
                    data: base64,
                    directory: Directory.Cache,
                });
                await Share.share({
                    title: nombreArchivo,
                    url: saved.uri,
                    dialogTitle: "Abrir o compartir reporte",
                });
            } else {
                doc.save(nombreArchivo);
            }
        } catch (err) {
            console.error(err);
            alert("Ocurrió un error al generar el reporte. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return { generar, loading };
}

// ── Check paginación ─────────────────────────────────────────
function checkPageInDoc(doc, y, needed = 15) {
    if (y + needed > PAGE_H - 16) {
        doc.addPage();
        return MARGIN;
    }
    return y;
}

// ── PORTADA ──────────────────────────────────────────────────
async function renderPortada(doc, proyecto) {
    // Fondo oscuro superior
    doc.setFillColor(...C.ink);
    doc.rect(0, 0, PAGE_W, PAGE_H * 0.55, "F");

    // Línea decorativa dorada
    doc.setFillColor(...C.taupe);
    doc.rect(0, PAGE_H * 0.55, PAGE_W, 1.5, "F");

    // Fondo inferior crema
    doc.setFillColor(...C.sand);
    doc.rect(0, PAGE_H * 0.55 + 1.5, PAGE_W, PAGE_H * 0.45, "F");

    // Logo
    try {
        await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                doc.addImage(img, "PNG", MARGIN, 18, 55, 30);
                resolve();
            };
            img.onerror = () => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(22);
                doc.setTextColor(...C.white);
                doc.text("H&E ARQUITECTOS", MARGIN, 35);
                resolve();
            };
            img.src = "/hye-letrasblancas.png";
        });
    } catch { /* fallback ya en onerror */ }

    // Título del reporte
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(180, 168, 150);
    doc.text("REPORTE EJECUTIVO DE PROYECTO", MARGIN, 68);

    // Línea separadora
    doc.setDrawColor(80, 70, 60);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, 72, PAGE_W - MARGIN, 72);

    // Nombre del proyecto
    const nombreProyecto = proyecto.name || proyecto.nombre || "Proyecto";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...C.white);
    const lineasNombre = doc.splitTextToSize(nombreProyecto.toUpperCase(), CONTENT_W);
    doc.text(lineasNombre, MARGIN, 85);

    // Cliente
    const yCliente = 85 + lineasNombre.length * 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(180, 168, 150);
    doc.text("Cliente:", MARGIN, yCliente);
    doc.setTextColor(...C.white);
    doc.text(proyecto.client || proyecto.cliente || "—", MARGIN + 22, yCliente);

    // Avance global — círculo grande
    const avance = proyecto.avance ?? calcAvance(proyecto.fases);
    const cx = PAGE_W - MARGIN - 22;
    const cy = 100;
    const r = 18;
    doc.setDrawColor(...C.taupe);
    doc.setLineWidth(2);
    doc.circle(cx, cy, r, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...C.white);
    doc.text(`${avance}%`, cx, cy + 2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 148, 130);
    doc.text("AVANCE", cx, cy + 8, { align: "center" });

    // Info inferior (sobre fondo crema)
    const yInfo = PAGE_H * 0.55 + 14;
    const cols = [];
    if (proyecto.status || proyecto.estado)
        cols.push(["ESTADO", proyecto.status || proyecto.estado]);
    if (proyecto.startDate || proyecto.fechaInicio)
        cols.push(["INICIO", formatDate(proyecto.startDate || proyecto.fechaInicio)]);
    if (proyecto.endDate || proyecto.fechaFin)
        cols.push(["ENTREGA ESTIMADA", formatDate(proyecto.endDate || proyecto.fechaFin)]);
    cols.push(["FASES TOTALES", String((proyecto.fases || []).length)]);
    const completadas = (proyecto.fases || []).filter(f => f.estado === "completada").length;
    cols.push(["FASES COMPLETADAS", `${completadas} de ${(proyecto.fases || []).length}`]);

    const colW = CONTENT_W / Math.min(cols.length, 4);
    cols.slice(0, 4).forEach(([label, valor], i) => {
        const x = MARGIN + i * colW;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.taupe);
        doc.text(label, x, yInfo);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.ink);
        doc.text(valor, x, yInfo + 7);
    });

    // Fecha generación
    const fechaHoy = new Date().toLocaleDateString("es-CO", {
        day: "2-digit", month: "long", year: "numeric",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.taupe);
    doc.text(`Documento generado el ${fechaHoy}`, PAGE_W - MARGIN, PAGE_H - 14, { align: "right" });
    doc.text("H&E Arquitectos — Confidencial", MARGIN, PAGE_H - 14);
}

// ── RESUMEN EJECUTIVO ────────────────────────────────────────
function renderResumenEjecutivo(doc, proyecto, fasesConDatos, isAdmin, yInit, checkPage) {
    let y = yInit;

    tituloSeccion(doc, "RESUMEN EJECUTIVO", y);
    y += 13;

    const avance = proyecto.avance ?? calcAvance(proyecto.fases);
    const fases = proyecto.fases || [];
    const completadas = fases.filter(f => f.estado === "completada").length;
    const enCurso = fases.filter(f => f.estado === "en_curso").length;
    const pendientes = fases.filter(f => f.estado === "pendiente").length;
    const totalNotas = fasesConDatos.reduce((a, f) => a + (f.notas?.length || 0), 0);
    const totalArchivos = fasesConDatos.reduce((a, f) => a + (f.archivos?.length || 0), 0);

    // Tarjetas de métricas
    const metricas = [
        { label: "Avance global", valor: `${avance}%`, color: C.completada },
        { label: "Completadas", valor: `${completadas}`, color: C.completada },
        { label: "En curso", valor: `${enCurso}`, color: C.en_curso },
        { label: "Pendientes", valor: `${pendientes}`, color: C.pendiente },
    ];

    const cardW = (CONTENT_W - 6) / 4;
    metricas.forEach(({ label, valor, color }, i) => {
        const x = MARGIN + i * (cardW + 2);
        doc.setFillColor(...C.sandDark);
        doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
        doc.setFillColor(...color);
        doc.roundedRect(x, y, cardW, 3, 2, 2, "F");
        doc.rect(x, y + 1.5, cardW, 1.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...C.ink);
        doc.text(valor, x + cardW / 2, y + 12, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...C.taupe);
        doc.text(label.toUpperCase(), x + cardW / 2, y + 17, { align: "center" });
    });
    y += 24;

    // Barra de progreso global
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.taupe);
    doc.text("PROGRESO GLOBAL DEL PROYECTO", MARGIN, y);
    y += 4;
    doc.setFillColor(...C.sandDark);
    doc.roundedRect(MARGIN, y, CONTENT_W - 16, 5, 1, 1, "F");
    const pct = Math.min(Math.max(avance, 0), 100) / 100;
    doc.setFillColor(...C.completada);
    if (pct > 0) doc.roundedRect(MARGIN, y, (CONTENT_W - 16) * pct, 5, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.ink);
    doc.text(`${avance}%`, PAGE_W - MARGIN, y + 4, { align: "right" });
    y += 12;

    // Detalles del proyecto
    const ficha = [
        ["Cliente", proyecto.client || proyecto.cliente || "—"],
        ["Estado", proyecto.status || proyecto.estado || "—"],
    ];
    if (isAdmin) {
        if (proyecto.startDate || proyecto.fechaInicio)
            ficha.push(["Fecha de inicio", formatDate(proyecto.startDate || proyecto.fechaInicio)]);
        if (proyecto.endDate || proyecto.fechaFin)
            ficha.push(["Entrega estimada", formatDate(proyecto.endDate || proyecto.fechaFin)]);
    }
    ficha.push(["Documentos adjuntos", `${totalArchivos} archivo${totalArchivos !== 1 ? "s" : ""}`]);
    ficha.push(["Notas registradas", `${totalNotas} nota${totalNotas !== 1 ? "s" : ""}`]);

    // Dos columnas
    const mid = Math.ceil(ficha.length / 2);
    const colW2 = (CONTENT_W - 6) / 2;
    ficha.forEach(([label, valor], i) => {
        const col = i < mid ? 0 : 1;
        const row = i < mid ? i : i - mid;
        const x = MARGIN + col * (colW2 + 6);
        const yRow = y + row * 9;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.taupe);
        doc.text(label.toUpperCase(), x, yRow);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);
        doc.text(valor, x, yRow + 5);
    });
    y += mid * 9 + 6;

    // Descripción si existe
    const desc = proyecto.description || proyecto.descripcion;
    if (desc) {
        y = checkPage(y, 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.taupe);
        doc.text("DESCRIPCIÓN", MARGIN, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);
        const lineas = doc.splitTextToSize(desc, CONTENT_W);
        doc.text(lineas, MARGIN, y);
        y += lineas.length * 5 + 4;
    }

    return y + 4;
}

// ── SECCIÓN DE FASES ─────────────────────────────────────────
function renderSeccionFases(doc, fasesConDatos, yInit, checkPage) {
    let y = yInit;
    y = checkPage(y, 20);
    tituloSeccion(doc, "DETALLE POR FASE", y);
    y += 13;

    for (const fase of fasesConDatos) {
        y = renderFase(doc, fase, y, checkPage);
    }
    return y;
}

function renderFase(doc, fase, yInit, checkPage) {
    let y = checkPage(yInit, 35);
    const estadoColor = C[fase.estado] || C.pendiente;
    const estadoLabel = { completada: "Completada", en_curso: "En curso", pendiente: "Pendiente" }[fase.estado] || fase.estado;

    // Cabecera de fase
    doc.setFillColor(...C.ink);
    doc.roundedRect(MARGIN, y, CONTENT_W, 13, 2, 2, "F");

    // Chip de estado
    doc.setFillColor(...estadoColor);
    doc.roundedRect(PAGE_W - MARGIN - 30, y + 2.5, 28, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(estadoLabel.toUpperCase(), PAGE_W - MARGIN - 16, y + 7.5, { align: "center" });

    // Nombre de fase
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    doc.text(fase.nombre || `Fase`, MARGIN + 4, y + 8.5);
    y += 16;

    // Fila: AVANCE + RESPONSABLE
    const pct = Math.min(Math.max(fase.porcentaje || 0, 0), 100) / 100;
    const barW = CONTENT_W - 16;

    // Etiqueta AVANCE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.taupe);
    doc.text("AVANCE", MARGIN, y + 1);

    // Valor %
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text(`${fase.porcentaje || 0}%`, MARGIN + 22, y + 1);

    // Responsable alineado a la derecha en la misma fila
    if (fase.responsable || fase.responsableNombre) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.taupe);
        doc.text("RESPONSABLE", MARGIN + 50, y + 1);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);
        doc.text(fase.responsable || fase.responsableNombre, MARGIN + 80, y + 1);
    }
    y += 7;

    // Barra de progreso
    doc.setFillColor(...C.sandDark);
    doc.roundedRect(MARGIN, y, barW, 4, 1, 1, "F");
    doc.setFillColor(...estadoColor);
    if (pct > 0) doc.roundedRect(MARGIN, y, barW * pct, 4, 1, 1, "F");
    y += 8;

    // Fechas en fila separada si existen
    if (fase.fechaInicio || fase.fechaFin || fase.fechaEntrega) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.taupe);
        if (fase.fechaInicio) {
            doc.text("INICIO", MARGIN, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.ink);
            doc.text(formatDate(fase.fechaInicio), MARGIN + 16, y);
        }
        if (fase.fechaFin || fase.fechaEntrega) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(...C.taupe);
            doc.text("ENTREGA", MARGIN + 70, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.ink);
            doc.text(formatDate(fase.fechaFin || fase.fechaEntrega), MARGIN + 88, y);
        }
        y += 8;
    }

    y = renderNotasFase(doc, fase, y, checkPage);
    y = renderArchivosFase(doc, fase, y, checkPage);

    if ((!fase.notas || fase.notas.length === 0) && (!fase.archivos || fase.archivos.length === 0)) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...C.taupe);
        doc.text("Sin notas ni archivos registrados en esta fase.", MARGIN + 2, y);
        y += 7;
    }

    // Separador
    doc.setDrawColor(...C.sandDark);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
    return y + 10;
}

function renderNotasFase(doc, fase, yInit, checkPage) {
    if (!fase.notas || fase.notas.length === 0) return yInit;
    let y = yInit + 2;
    y = checkPage(y, 16);

    // Header con fondo
    doc.setFillColor(...C.sand);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.accent);
    doc.text("NOTAS", MARGIN + 4, y + 5.5);
    // Badge contador
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.taupe);
    doc.text(`${fase.notas.length}`, MARGIN + 22, y + 5.5);
    y += 12;

    for (const nota of fase.notas) {
        const fechaNota = nota.createdAt?.toDate
            ? nota.createdAt.toDate().toLocaleDateString("es-CO") : "";
        const autor = nota.autorNombre || nota.autor || "";
        const prefijo = [fechaNota, autor].filter(Boolean).join(" · ");
        const texto = nota.text || nota.contenido || "";
        const lineas = doc.splitTextToSize(`• ${texto}`, CONTENT_W - 8);
        y = checkPage(y, lineas.length * 5 + 8);

        if (prefijo) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.taupe);
            doc.text(prefijo, MARGIN + 4, y);
            y += 4;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);
        doc.text(lineas, MARGIN + 4, y);
        y += lineas.length * 5 + 3;
    }
    return y + 2;
}

function renderArchivosFase(doc, fase, yInit, checkPage) {
    if (!fase.archivos || fase.archivos.length === 0) return yInit;
    let y = yInit + 2;
    y = checkPage(y, 16);

    // Header con fondo
    doc.setFillColor(...C.sand);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.accent);
    doc.text("ARCHIVOS ADJUNTOS", MARGIN + 4, y + 5.5);
    // Badge contador
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.taupe);
    doc.text(`${fase.archivos.length}`, MARGIN + 46, y + 5.5);
    y += 12;

    for (const archivo of fase.archivos) {
        y = checkPage(y, 8);
        const nombre = archivo.fileName || "Archivo sin nombre";
        const fecha = archivo.createdAt?.toDate
            ? archivo.createdAt.toDate().toLocaleDateString("es-CO") : "";

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);

        const maxW = CONTENT_W - 36;
        let nombreMostrar = nombre;
        while (doc.getTextWidth(nombreMostrar) > maxW && nombreMostrar.length > 10)
            nombreMostrar = nombreMostrar.slice(0, -4) + "...";

        doc.text(`→  ${nombreMostrar}`, MARGIN + 4, y);

        if (fecha) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.taupe);
            doc.text(fecha, PAGE_W - MARGIN - 20, y);
        }

        if (archivo.downloadURL) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(80, 120, 180);
            doc.textWithLink("Ver →", PAGE_W - MARGIN, y, { url: archivo.downloadURL, align: "right" });
        }

        doc.setDrawColor(...C.sandDark);
        doc.setLineWidth(0.2);
        doc.line(MARGIN + 4, y + 2, PAGE_W - MARGIN, y + 2);
        doc.setTextColor(...C.ink);
        y += 7;
    }
    return y + 2;
}

// ── PIE DE PÁGINA ────────────────────────────────────────────
function renderPiePaginas(doc) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(...C.ink);
        doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(160, 148, 130);
        doc.text("H&E Arquitectos — Documento confidencial generado automáticamente", MARGIN, PAGE_H - 5);
        doc.text(`${i} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: "right" });
    }
}

// ── Título de sección ────────────────────────────────────────
function tituloSeccion(doc, texto, y) {
    // Barra lateral izquierda
    doc.setFillColor(...C.ink);
    doc.rect(MARGIN, y, 3, 9, "F");
    // Texto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text(texto, MARGIN + 7, y + 7);
    // Línea separadora debajo del texto
    doc.setFillColor(...C.sandDark);
    doc.rect(MARGIN + 3, y + 10, CONTENT_W - 3, 0.5, "F");
}

// ── Helpers ──────────────────────────────────────────────────
async function cargarDatosFases(projectId, fases, isAdmin) {
    return Promise.all(
        fases.map(async (fase) => {
            try {
                const notasRef = collection(db, "projects", projectId, "fases", fase.id, "notas");
                const notasSnap = await getDocs(query(notasRef, orderBy("createdAt", "desc")));
                const notas = notasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const archRef = collection(db, "projects", projectId, "fases", fase.id, "archivos");
                const archSnap = await getDocs(query(archRef, orderBy("createdAt", "desc")));
                const archivos = archSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(a => isAdmin ? true : a.visibleToClient === true);

                return { ...fase, notas, archivos };
            } catch {
                return { ...fase, notas: [], archivos: [] };
            }
        })
    );
}

function calcAvance(fases = []) {
    if (!fases.length) return 0;
    const suma = fases.reduce((acc, f) => acc + (Number(f.porcentaje) || 0), 0);
    return Math.round(suma / fases.length);
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
        return new Date(dateStr).toLocaleDateString("es-CO", {
            day: "2-digit", month: "long", year: "numeric",
        });
    } catch {
        return dateStr;
    }
}
