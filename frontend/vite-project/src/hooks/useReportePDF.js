// src/hooks/useReportePDF.js
// Reporte ejecutivo PDF — H&E Arquitectos

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
    sandDark:   [228, 221, 208],
    white:      [255, 255, 255],
    completada: [74,  124, 89],
    en_curso:   [201, 160, 56],
    pendiente:  [170, 163, 150],
    accent:     [101, 87,  68],
    gold:       [180, 155, 110],
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

// ── Cargar logo con proporciones correctas ───────────────────
function loadImageWithRatio(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve({ img, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// ── PORTADA ──────────────────────────────────────────────────
async function renderPortada(doc, proyecto) {
    const coverH = PAGE_H * 0.52;

    // Fondo oscuro superior
    doc.setFillColor(...C.ink);
    doc.rect(0, 0, PAGE_W, coverH, "F");

    // Franja dorada decorativa
    doc.setFillColor(...C.gold);
    doc.rect(0, coverH, PAGE_W, 1.2, "F");

    // Franja secundaria muy delgada
    doc.setFillColor(...C.taupe);
    doc.rect(0, coverH + 1.2, PAGE_W, 0.4, "F");

    // Fondo inferior crema
    doc.setFillColor(...C.sand);
    doc.rect(0, coverH + 1.6, PAGE_W, PAGE_H - coverH - 1.6, "F");

    // Línea lateral izquierda decorativa (acento)
    doc.setFillColor(...C.gold);
    doc.rect(MARGIN, 16, 0.8, 42, "F");

    // ── Logo ─────────────────────────────────────────────────
    const logoResult = await loadImageWithRatio("/hye-letrasblancas.png");
    let yAfterLogo = 36;

    if (logoResult) {
        const { img, w, h } = logoResult;
        const logoMaxW = 72;
        const logoW = logoMaxW;
        const logoH = Math.round((h / w) * logoW);
        const logoX = MARGIN + 4;
        const logoY = 18;
        doc.addImage(img, "PNG", logoX, logoY, logoW, logoH);
        yAfterLogo = logoY + logoH + 6;
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(...C.white);
        doc.text("H&E ARQUITECTOS", MARGIN + 4, 34);
        yAfterLogo = 44;
    }

    // Línea bajo el logo
    doc.setDrawColor(...C.taupe);
    doc.setLineWidth(0.3);
    doc.line(MARGIN + 4, yAfterLogo, PAGE_W - MARGIN, yAfterLogo);
    yAfterLogo += 6;

    // Etiqueta "REPORTE EJECUTIVO"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gold);
    doc.setCharSpace(2);
    doc.text("REPORTE EJECUTIVO DE PROYECTO", MARGIN + 4, yAfterLogo);
    doc.setCharSpace(0);
    yAfterLogo += 7;

    // Tipo de proyecto (si existe)
    const tipo = proyecto.type || proyecto.tipo;
    if (tipo) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.taupe);
        doc.setCharSpace(1.5);
        doc.text(tipo.toUpperCase(), MARGIN + 4, yAfterLogo);
        doc.setCharSpace(0);
        yAfterLogo += 6;
    }

    // ── Avance — círculo ─────────────────────────────────────
    const avance = proyecto.avance ?? calcAvance(proyecto.fases);
    const cx = PAGE_W - MARGIN - 24;
    const cy = yAfterLogo + 14;
    const r = 16;

    // Arco de fondo
    doc.setDrawColor(60, 55, 48);
    doc.setLineWidth(3);
    doc.circle(cx, cy, r, "S");

    // Arco de progreso (simulado con color dorado)
    doc.setDrawColor(...C.gold);
    doc.setLineWidth(3);
    // Dibuja segmentos cortos para simular el arco
    const totalSteps = 36;
    const steps = Math.round((avance / 100) * totalSteps);
    for (let s = 0; s < steps; s++) {
        const a1 = ((s / totalSteps) * 2 * Math.PI) - Math.PI / 2;
        const a2 = (((s + 0.85) / totalSteps) * 2 * Math.PI) - Math.PI / 2;
        doc.setDrawColor(...C.gold);
        doc.setLineWidth(3);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2);
        const y2 = cy + r * Math.sin(a2);
        doc.line(x1, y1, x2, y2);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...C.white);
    doc.text(`${avance}%`, cx, cy + 3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...C.gold);
    doc.setCharSpace(1);
    doc.text("AVANCE", cx, cy + 9, { align: "center" });
    doc.setCharSpace(0);

    // ── Nombre del proyecto ──────────────────────────────────
    const nombreProyecto = proyecto.name || proyecto.nombre || "Proyecto";
    const maxNombreW = cx - r - MARGIN - 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...C.white);
    const lineasNombre = doc.splitTextToSize(nombreProyecto.toUpperCase(), maxNombreW);
    doc.text(lineasNombre, MARGIN + 4, yAfterLogo + 12);

    // ── Cliente ──────────────────────────────────────────────
    const yCliente = yAfterLogo + 12 + lineasNombre.length * 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.taupe);
    doc.text("CLIENTE", MARGIN + 4, yCliente);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    doc.text(
        proyecto.client || proyecto.cliente || "—",
        MARGIN + 4, yCliente + 6,
        { maxWidth: maxNombreW }
    );

    // ── Info inferior sobre fondo crema ─────────────────────
    const yInfo = coverH + 12;
    const cols = [];

    if (proyecto.status || proyecto.estado)
        cols.push(["ESTADO", proyecto.status || proyecto.estado]);
    if (proyecto.code || proyecto.codigo)
        cols.push(["CÓDIGO", proyecto.code || proyecto.codigo]);
    if (proyecto.startDate || proyecto.fechaInicio)
        cols.push(["INICIO", formatDate(proyecto.startDate || proyecto.fechaInicio)]);
    if (proyecto.endDate || proyecto.fechaFin)
        cols.push(["ENTREGA EST.", formatDate(proyecto.endDate || proyecto.fechaFin)]);

    const fases = proyecto.fases || [];
    cols.push(["FASES", String(fases.length)]);
    const completadas = fases.filter(f => f.estado === "completada").length;
    cols.push(["COMPLETADAS", `${completadas} / ${fases.length}`]);

    const maxCols = Math.min(cols.length, 5);
    const colW = CONTENT_W / maxCols;

    cols.slice(0, maxCols).forEach(([label, valor], i) => {
        const x = MARGIN + i * colW;

        // Mini separador vertical (excepto primero)
        if (i > 0) {
            doc.setDrawColor(...C.sandDark);
            doc.setLineWidth(0.3);
            doc.line(x - 1, yInfo - 2, x - 1, yInfo + 13);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...C.taupe);
        doc.setCharSpace(1);
        doc.text(label, x, yInfo);
        doc.setCharSpace(0);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...C.ink);
        doc.text(valor, x, yInfo + 8, { maxWidth: colW - 3 });
    });

    // ── Fecha generación ─────────────────────────────────────
    const fechaHoy = new Date().toLocaleDateString("es-CO", {
        day: "2-digit", month: "long", year: "numeric",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.taupe);
    doc.text(`Generado el ${fechaHoy}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
    doc.text("H&E Arquitectos — Confidencial", MARGIN, PAGE_H - 10);
}

// ── RESUMEN EJECUTIVO ────────────────────────────────────────
function renderResumenEjecutivo(doc, proyecto, fasesConDatos, isAdmin, yInit, checkPage) {
    let y = yInit;

    tituloSeccion(doc, "RESUMEN EJECUTIVO", y);
    y += 14;

    const avance = proyecto.avance ?? calcAvance(proyecto.fases);
    const fases = proyecto.fases || [];
    const completadas = fases.filter(f => f.estado === "completada").length;
    const enCurso = fases.filter(f => f.estado === "en_curso").length;
    const pendientes = fases.filter(f => f.estado === "pendiente").length;
    const totalNotas = fasesConDatos.reduce((a, f) => a + (f.notas?.length || 0), 0);
    const totalArchivos = fasesConDatos.reduce((a, f) => a + (f.archivos?.length || 0), 0);

    // ── Tarjetas de métricas ─────────────────────────────────
    const metricas = [
        { label: "Avance global", valor: `${avance}%`, color: C.completada },
        { label: "Completadas", valor: `${completadas}`, color: C.completada },
        { label: "En curso", valor: `${enCurso}`, color: C.en_curso },
        { label: "Pendientes", valor: `${pendientes}`, color: C.pendiente },
        { label: "Archivos", valor: `${totalArchivos}`, color: C.taupe },
        { label: "Notas", valor: `${totalNotas}`, color: C.taupe },
    ];

    const cardW = (CONTENT_W - 10) / 6;
    metricas.forEach(({ label, valor, color }, i) => {
        const x = MARGIN + i * (cardW + 2);
        doc.setFillColor(...C.sandDark);
        doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
        // Barra de color superior
        doc.setFillColor(...color);
        doc.roundedRect(x, y, cardW, 3, 2, 2, "F");
        doc.rect(x, y + 1.5, cardW, 1.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...C.ink);
        doc.text(valor, x + cardW / 2, y + 12, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(...C.taupe);
        doc.text(label.toUpperCase(), x + cardW / 2, y + 16.5, { align: "center" });
    });
    y += 24;

    // ── Barra de progreso global ─────────────────────────────
    const barW = CONTENT_W - 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.taupe);
    doc.text("PROGRESO GLOBAL", MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.ink);
    doc.text(`${avance}%`, MARGIN + barW + 6, y);
    y += 4;
    doc.setFillColor(...C.sandDark);
    doc.roundedRect(MARGIN, y, barW, 5, 1.5, 1.5, "F");
    const pct = Math.min(Math.max(avance, 0), 100) / 100;
    if (pct > 0) {
        doc.setFillColor(...C.completada);
        doc.roundedRect(MARGIN, y, barW * pct, 5, 1.5, 1.5, "F");
    }
    y += 12;

    // ── Ficha del proyecto ───────────────────────────────────
    tituloSeccion(doc, "INFORMACIÓN DEL PROYECTO", y);
    y += 14;

    const ficha = [];

    // Columna 1
    const col1 = [];
    col1.push(["Cliente", proyecto.client || proyecto.cliente || "—"]);
    if (proyecto.type || proyecto.tipo)
        col1.push(["Tipo de proyecto", proyecto.type || proyecto.tipo]);
    col1.push(["Estado", proyecto.status || proyecto.estado || "—"]);
    if (proyecto.code || proyecto.codigo)
        col1.push(["Código", proyecto.code || proyecto.codigo]);
    if (isAdmin) {
        if (proyecto.budget)
            col1.push(["Presupuesto", formatBudget(proyecto.budget)]);
    }

    // Columna 2
    const col2 = [];
    if (proyecto.startDate || proyecto.fechaInicio)
        col2.push(["Fecha de inicio", formatDate(proyecto.startDate || proyecto.fechaInicio)]);
    if (proyecto.endDate || proyecto.fechaFin)
        col2.push(["Entrega estimada", formatDate(proyecto.endDate || proyecto.fechaFin)]);
    if (isAdmin && (proyecto.clientEmail || proyecto.clientPhone))
        col2.push(["Correo cliente", proyecto.clientEmail || "—"]);
    if (isAdmin && proyecto.clientPhone)
        col2.push(["Teléfono cliente", proyecto.clientPhone]);
    if (proyecto.projectAddress || proyecto.city) {
        const dir = [proyecto.projectAddress, proyecto.city].filter(Boolean).join(", ");
        col2.push(["Dirección", dir]);
    }

    const maxRows = Math.max(col1.length, col2.length);
    const colW2 = (CONTENT_W - 6) / 2;

    for (let i = 0; i < maxRows; i++) {
        const rowH = 9;
        y = checkPage(y, rowH + 2);

        if (col1[i]) {
            const [label, valor] = col1[i];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(...C.taupe);
            doc.text(label.toUpperCase(), MARGIN, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C.ink);
            doc.text(String(valor), MARGIN, y + 5, { maxWidth: colW2 - 2 });
        }

        if (col2[i]) {
            const [label, valor] = col2[i];
            const x2 = MARGIN + colW2 + 6;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(...C.taupe);
            doc.text(label.toUpperCase(), x2, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C.ink);
            doc.text(String(valor), x2, y + 5, { maxWidth: colW2 - 2 });
        }

        // Línea divisoria entre filas
        doc.setDrawColor(...C.sandDark);
        doc.setLineWidth(0.2);
        doc.line(MARGIN, y + rowH - 1, PAGE_W - MARGIN, y + rowH - 1);
        y += rowH;
    }

    // ── Descripción ──────────────────────────────────────────
    const desc = proyecto.description || proyecto.descripcion;
    if (desc) {
        y += 4;
        y = checkPage(y, 24);
        tituloSeccion(doc, "DESCRIPCIÓN DEL PROYECTO", y);
        y += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);
        const lineas = doc.splitTextToSize(desc, CONTENT_W);
        y = checkPage(y, lineas.length * 5 + 4);
        // Fondo sutil
        doc.setFillColor(...C.sand);
        doc.roundedRect(MARGIN, y - 2, CONTENT_W, lineas.length * 5 + 6, 2, 2, "F");
        doc.text(lineas, MARGIN + 4, y + 3);
        y += lineas.length * 5 + 8;
    }

    return y + 6;
}

// ── SECCIÓN DE FASES ─────────────────────────────────────────
function renderSeccionFases(doc, fasesConDatos, yInit, checkPage) {
    let y = yInit;
    if (fasesConDatos.length === 0) return y;
    y = checkPage(y, 20);
    tituloSeccion(doc, "DETALLE POR FASE", y);
    y += 14;

    for (const fase of fasesConDatos) {
        y = renderFase(doc, fase, y, checkPage);
    }
    return y;
}

function renderFase(doc, fase, yInit, checkPage) {
    let y = checkPage(yInit, 40);
    const estadoColor = C[fase.estado] || C.pendiente;
    const estadoLabel = {
        completada: "Completada",
        en_curso: "En curso",
        pendiente: "Pendiente"
    }[fase.estado] || fase.estado || "—";

    // ── Cabecera de fase ─────────────────────────────────────
    doc.setFillColor(...C.ink);
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");

    // Franja de color izquierda según estado
    doc.setFillColor(...estadoColor);
    doc.roundedRect(MARGIN, y, 3.5, 14, 2, 2, "F");
    doc.rect(MARGIN + 2, y, 1.5, 14, "F");

    // Chip de estado (derecha)
    doc.setFillColor(...estadoColor);
    doc.roundedRect(PAGE_W - MARGIN - 30, y + 3, 28, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.white);
    doc.text(estadoLabel.toUpperCase(), PAGE_W - MARGIN - 16, y + 7.8, { align: "center" });

    // Nombre de fase
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    const nombreFase = fase.nombre || fase.name || "Fase";
    doc.text(nombreFase, MARGIN + 8, y + 9.5, { maxWidth: PAGE_W - MARGIN * 2 - 40 });
    y += 17;

    // ── Avance ───────────────────────────────────────────────
    const pct = Math.min(Math.max(fase.porcentaje || 0, 0), 100) / 100;
    const barW = CONTENT_W - 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.taupe);
    doc.text("AVANCE", MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text(`${fase.porcentaje || 0}%`, MARGIN + 22, y);

    if (fase.responsable || fase.responsableNombre) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.taupe);
        doc.text("RESPONSABLE", MARGIN + 48, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);
        doc.text(
            fase.responsable || fase.responsableNombre,
            MARGIN + 78, y,
            { maxWidth: CONTENT_W - 80 }
        );
    }
    y += 6;

    // Barra de progreso
    doc.setFillColor(...C.sandDark);
    doc.roundedRect(MARGIN, y, barW, 4, 1.5, 1.5, "F");
    if (pct > 0) {
        doc.setFillColor(...estadoColor);
        doc.roundedRect(MARGIN, y, barW * pct, 4, 1.5, 1.5, "F");
    }
    y += 8;

    // ── Fechas ───────────────────────────────────────────────
    if (fase.fechaInicio || fase.fechaFin || fase.fechaEntrega) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.taupe);

        if (fase.fechaInicio) {
            doc.text("INICIO", MARGIN, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.ink);
            doc.text(formatDate(fase.fechaInicio), MARGIN + 17, y);
        }
        if (fase.fechaFin || fase.fechaEntrega) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(...C.taupe);
            doc.text("ENTREGA", MARGIN + 72, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.ink);
            doc.text(formatDate(fase.fechaFin || fase.fechaEntrega), MARGIN + 91, y);
        }
        y += 8;
    }

    y = renderNotasFase(doc, fase, y, checkPage);
    y = renderArchivosFase(doc, fase, y, checkPage);

    if ((!fase.notas || fase.notas.length === 0) && (!fase.archivos || fase.archivos.length === 0)) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...C.taupe);
        doc.text("Sin notas ni archivos en esta fase.", MARGIN + 2, y + 1);
        y += 8;
    }

    // Separador entre fases
    doc.setDrawColor(...C.sandDark);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y + 3, PAGE_W - MARGIN, y + 3);
    return y + 10;
}

function renderNotasFase(doc, fase, yInit, checkPage) {
    if (!fase.notas || fase.notas.length === 0) return yInit;
    let y = yInit + 2;
    y = checkPage(y, 16);

    doc.setFillColor(...C.sand);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.accent);
    doc.text("NOTAS", MARGIN + 4, y + 5.5);
    doc.setTextColor(...C.taupe);
    doc.text(`(${fase.notas.length})`, MARGIN + 22, y + 5.5);
    y += 12;

    for (const nota of fase.notas) {
        const fechaNota = nota.createdAt?.toDate
            ? nota.createdAt.toDate().toLocaleDateString("es-CO") : "";
        const autor = nota.autorNombre || nota.autor || "";
        const prefijo = [fechaNota, autor].filter(Boolean).join(" · ");
        const texto = nota.text || nota.contenido || "";
        const lineas = doc.splitTextToSize(`• ${texto}`, CONTENT_W - 10);
        y = checkPage(y, lineas.length * 5 + 8);

        if (prefijo) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
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

    doc.setFillColor(...C.sand);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.accent);
    doc.text("ARCHIVOS ADJUNTOS", MARGIN + 4, y + 5.5);
    doc.setTextColor(...C.taupe);
    doc.text(`(${fase.archivos.length})`, MARGIN + 48, y + 5.5);
    y += 12;

    for (const archivo of fase.archivos) {
        y = checkPage(y, 8);
        const nombre = archivo.fileName || "Archivo sin nombre";
        const fecha = archivo.createdAt?.toDate
            ? archivo.createdAt.toDate().toLocaleDateString("es-CO") : "";
        const size = formatSize(archivo.size);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.ink);

        const maxW = CONTENT_W - 44;
        let nombreMostrar = nombre;
        while (doc.getTextWidth(nombreMostrar) > maxW && nombreMostrar.length > 12)
            nombreMostrar = nombreMostrar.slice(0, -4) + "…";

        doc.text(`→  ${nombreMostrar}`, MARGIN + 4, y);

        if (size && size !== "—") {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...C.taupe);
            doc.text(size, MARGIN + 4, y + 4);
        }

        if (fecha) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.taupe);
            doc.text(fecha, PAGE_W - MARGIN - 22, y);
        }

        if (archivo.downloadURL) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(80, 120, 180);
            doc.textWithLink("Abrir →", PAGE_W - MARGIN, y, { url: archivo.downloadURL, align: "right" });
        }

        doc.setDrawColor(...C.sandDark);
        doc.setLineWidth(0.2);
        doc.line(MARGIN + 4, y + 6, PAGE_W - MARGIN, y + 6);
        y += 9;
    }
    return y + 2;
}

// ── PIE DE PÁGINA ────────────────────────────────────────────
function renderPiePaginas(doc) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Fondo pie
        doc.setFillColor(...C.ink);
        doc.rect(0, PAGE_H - 11, PAGE_W, 11, "F");

        // Franja dorada
        doc.setFillColor(...C.gold);
        doc.rect(0, PAGE_H - 11, PAGE_W, 0.8, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(160, 148, 130);
        doc.text("H&E Arquitectos — Documento confidencial generado automáticamente", MARGIN, PAGE_H - 4.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.gold);
        doc.text(`${i} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 4.5, { align: "right" });
    }
}

// ── Título de sección ────────────────────────────────────────
function tituloSeccion(doc, texto, y) {
    // Rectángulo de fondo completo
    doc.setFillColor(...C.ink);
    doc.roundedRect(MARGIN, y, CONTENT_W, 10, 1.5, 1.5, "F");

    // Franja dorada izquierda
    doc.setFillColor(...C.gold);
    doc.roundedRect(MARGIN, y, 3, 10, 1.5, 1.5, "F");
    doc.rect(MARGIN + 1.5, y, 1.5, 10, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.white);
    doc.setCharSpace(1.2);
    doc.text(texto, MARGIN + 8, y + 6.8);
    doc.setCharSpace(0);
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

function formatBudget(val) {
    const n = Number(val);
    if (!isFinite(n) || n <= 0) return String(val);
    return new Intl.NumberFormat("es-CO", {
        style: "currency", currency: "COP", maximumFractionDigits: 0,
    }).format(n);
}

function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const kb = n / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}
