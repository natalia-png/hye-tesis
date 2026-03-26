// src/hooks/useReportePDF.js
// Genera un PDF completo del proyecto con fases, notas y archivos
// Usa jsPDF (instalar: npm install jspdf)

import { useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { jsPDF } from "jspdf";

// ── Paleta H&E ──────────────────────────────────────────────
const COLOR = {
    ink: [30, 27, 24],   // títulos principales
    taupe: [139, 125, 107],  // subtítulos / separadores
    sand: [245, 240, 230],  // fondos de sección
    white: [255, 255, 255],
    completada: [74, 124, 89], // verde
    en_curso: [201, 160, 56], // amarillo
    pendiente: [180, 173, 160],// gris
};

const MARGIN = 20;
const PAGE_W = 210; // A4 mm
const CONTENT_W = PAGE_W - MARGIN * 2;

export function useReportePDF() {
    const [loading, setLoading] = useState(false);

    const generar = async (proyecto, isAdmin = false) => {
        setLoading(true);
        try {
            // 1 ── Cargar notas y archivos de cada fase en paralelo
            const fasesConDatos = await cargarDatosFases(
                proyecto.id,
                proyecto.fases || [],
                isAdmin
            );

            // 2 ── Construir el PDF
            const doc = new jsPDF({ unit: "mm", format: "a4" });
            let y = 0;

            // ── Función helper para nueva página ──────────────────
            const checkPage = (needed = 15) => {
                if (y + needed > 277) {
                    doc.addPage();
                    y = MARGIN;
                }
            };

            // ═══════════════════════════════════════════════════════
            // PORTADA / ENCABEZADO
            // ═══════════════════════════════════════════════════════
            // Franja superior oscura
            doc.setFillColor(...COLOR.ink);
            doc.rect(0, 0, PAGE_W, 38, "F");

            // Fecha de generación
            const fechaHoy = new Date().toLocaleDateString("es-CO", {
                day: "2-digit", month: "long", year: "numeric",
            });

            // Intentar cargar el logo desde /public/logo-header.png
            try {
                await new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        // Logo en la esquina izquierda del header oscuro
                        doc.addImage(img, "PNG", MARGIN, 6, 40, 22);
                        resolve();
                    };
                    img.onerror = () => {
                        // Si falla el logo, mostrar texto
                        doc.setTextColor(...COLOR.white);
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(18);
                        doc.text("H&E ARQUITECTOS", MARGIN, 17);
                        resolve();
                    };
                    img.src = "/hye-letrasblancas.png";
                });
            } catch {
                doc.setTextColor(...COLOR.white);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(18);
                doc.text("H&E ARQUITECTOS", MARGIN, 17);
            }

            // Subtítulo y fecha a la derecha
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(200, 190, 175);
            doc.text("Reporte de Proyecto", PAGE_W - MARGIN, 20, { align: "right" });
            doc.text(`Generado el ${fechaHoy}`, PAGE_W - MARGIN, 28, { align: "right" });

            y = 52;

            // ═══════════════════════════════════════════════════════
            // FICHA DEL PROYECTO
            // ═══════════════════════════════════════════════════════
            seccionTitulo(doc, "INFORMACIÓN DEL PROYECTO", y);
            y += 14;

            const avance = proyecto.avance ?? calcAvance(proyecto.fases);
            const campos = [
                ["Nombre del proyecto", proyecto.name || proyecto.nombre || "—"],
                ["Cliente", proyecto.client || proyecto.cliente || "—"],
                ["Estado", proyecto.status || proyecto.estado || "—"],
                ["Avance global", `${avance}%`],
            ];

            if (isAdmin) {
                if (proyecto.startDate || proyecto.fechaInicio)
                    campos.push(["Fecha de inicio", formatDate(proyecto.startDate || proyecto.fechaInicio)]);
                if (proyecto.endDate || proyecto.fechaFin)
                    campos.push(["Entrega estimada", formatDate(proyecto.endDate || proyecto.fechaFin)]);
            }

            campos.forEach(([label, valor]) => {
                checkPage(8);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(...COLOR.taupe);
                doc.text(label.toUpperCase(), MARGIN, y);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(...COLOR.ink);
                doc.text(String(valor), MARGIN + 52, y);
                y += 7;
            });

            // Barra de avance global
            y += 3;
            checkPage(14);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...COLOR.taupe);
            doc.text("AVANCE GLOBAL", MARGIN, y);
            y += 4;

            const barW = CONTENT_W;
            doc.setFillColor(230, 225, 215);
            doc.roundedRect(MARGIN, y, barW, 5, 1, 1, "F");
            const pct = Math.min(Math.max(avance, 0), 100) / 100;
            doc.setFillColor(...COLOR.completada);
            if (pct > 0) doc.roundedRect(MARGIN, y, barW * pct, 5, 1, 1, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...COLOR.ink);
            doc.text(`${avance}%`, MARGIN + barW + 3, y + 4);
            y += 14;

            // ═══════════════════════════════════════════════════════
            // FASES
            // ═══════════════════════════════════════════════════════
            seccionTitulo(doc, "DETALLE POR FASE", y);
            y += 10;

            for (const fase of fasesConDatos) {
                checkPage(30);

                // ── Cabecera de fase ─────────────────────────────────
                const estadoColor = COLOR[fase.estado] || COLOR.pendiente;
                doc.setFillColor(...COLOR.sand);
                doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, "F");

                // Nombre
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(...COLOR.ink);
                doc.text(fase.nombre || `Fase ${fase.id}`, MARGIN + 4, y + 8);

                // Badge estado
                const estadoLabel = {
                    completada: "Completada",
                    en_curso: "En curso",
                    pendiente: "Pendiente",
                }[fase.estado] || fase.estado;

                doc.setFillColor(...estadoColor);
                doc.roundedRect(PAGE_W - MARGIN - 32, y + 2, 32, 8, 2, 2, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor(...COLOR.white);
                doc.text(estadoLabel, PAGE_W - MARGIN - 16, y + 7, { align: "center" });

                y += 15;

                // Barra de avance de la fase
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...COLOR.taupe);
                doc.text(`Avance: ${fase.porcentaje || 0}%`, MARGIN, y);
                y += 4;

                const faseBarW = CONTENT_W - 20;
                doc.setFillColor(230, 225, 215);
                doc.roundedRect(MARGIN, y, faseBarW, 3, 1, 1, "F");
                const fasePct = Math.min(Math.max(fase.porcentaje || 0, 0), 100) / 100;
                doc.setFillColor(...estadoColor);
                if (fasePct > 0) doc.roundedRect(MARGIN, y, faseBarW * fasePct, 3, 1, 1, "F");
                y += 8;

                // ── Notas ────────────────────────────────────────────
                if (fase.notas && fase.notas.length > 0) {
                    checkPage(10);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(...COLOR.taupe);
                    doc.text("NOTAS", MARGIN, y);
                    y += 5;

                    for (const nota of fase.notas) {
                        const fechaNota = nota.createdAt?.toDate
                            ? nota.createdAt.toDate().toLocaleDateString("es-CO")
                            : "";

                        const textoCompleto = nota.text || "";
                        const lineas = doc.splitTextToSize(
                            `• ${fechaNota ? `[${fechaNota}] ` : ""}${textoCompleto}`,
                            CONTENT_W - 4
                        );

                        checkPage(lineas.length * 5 + 4);
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(9);
                        doc.setTextColor(...COLOR.ink);
                        doc.text(lineas, MARGIN + 2, y);
                        y += lineas.length * 5 + 3;
                    }
                    y += 2;
                }

                // ── Archivos ─────────────────────────────────────────
                if (fase.archivos && fase.archivos.length > 0) {
                    checkPage(10);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8);
                    doc.setTextColor(...COLOR.taupe);
                    doc.text("ARCHIVOS", MARGIN, y);
                    y += 5;

                    for (const archivo of fase.archivos) {
                        checkPage(8);

                        const nombreArchivo = archivo.fileName || "Archivo sin nombre";
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(9);

                        // Viñeta
                        doc.setTextColor(...COLOR.taupe);
                        doc.text("-", MARGIN + 2, y);

                        // Nombre truncado si es muy largo
                        doc.setTextColor(...COLOR.ink);
                        const maxW = CONTENT_W - 30;
                        let nombreMostrar = nombreArchivo;
                        while (doc.getTextWidth(nombreMostrar) > maxW && nombreMostrar.length > 10) {
                            nombreMostrar = nombreMostrar.slice(0, -4) + "...";
                        }
                        doc.text(nombreMostrar, MARGIN + 6, y);

                        // "Ver archivo" alineado a la derecha, clickeable
                        if (archivo.downloadURL) {
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(8);
                            doc.setTextColor(80, 120, 180);
                            doc.textWithLink("Ver archivo", PAGE_W - MARGIN, y, {
                                url: archivo.downloadURL,
                                align: "right",
                            });
                        }

                        // Línea separadora sutil
                        doc.setDrawColor(235, 230, 220);
                        doc.setLineWidth(0.2);
                        doc.line(MARGIN + 6, y + 2, PAGE_W - MARGIN, y + 2);
                        doc.setTextColor(...COLOR.ink);
                        y += 7;
                    }
                    y += 2;
                }

                // Sin notas ni archivos
                if ((!fase.notas || fase.notas.length === 0) && (!fase.archivos || fase.archivos.length === 0)) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(8);
                    doc.setTextColor(...COLOR.taupe);
                    doc.text("Sin notas ni archivos registrados.", MARGIN + 2, y);
                    y += 7;
                }

                // Separador entre fases
                doc.setDrawColor(...COLOR.sand);
                doc.setLineWidth(0.5);
                doc.line(MARGIN, y, PAGE_W - MARGIN, y);
                y += 8;
            }

            // ═══════════════════════════════════════════════════════
            // PIE DE PÁGINA en todas las páginas
            // ═══════════════════════════════════════════════════════
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFillColor(...COLOR.sand);
                doc.rect(0, 287, PAGE_W, 10, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(...COLOR.taupe);
                doc.text("H&E Arquitectos — Documento generado automáticamente", MARGIN, 293);
                doc.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN, 293, { align: "right" });
            }

            // ═══════════════════════════════════════════════════════
            // DESCARGAR
            // ═══════════════════════════════════════════════════════
            const nombreArchivo = `Reporte-${(proyecto.name || proyecto.nombre || "Proyecto")
                .replaceAll(/\s+/g, "-")
                .replaceAll(/[^a-zA-Z0-9-]/g, "")}-${new Date().toISOString().slice(0, 10)}.pdf`;

            doc.save(nombreArchivo);
        } catch (err) {
            alert("Ocurrió un error al generar el reporte. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return { generar, loading };
}

// ── Helpers ──────────────────────────────────────────────────

async function cargarDatosFases(projectId, fases, isAdmin) {
    return Promise.all(
        fases.map(async (fase) => {
            try {
                // Notas — admin ve todas, cliente solo las visibles
                const notasRef = collection(db, "projects", projectId, "fases", fase.id, "notas");
                const notasSnap = await getDocs(query(notasRef, orderBy("createdAt", "desc")));
                const notas = notasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Archivos — admin ve todos, cliente solo visibles
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

function seccionTitulo(doc, texto, y) {
    doc.setFillColor(...COLOR.ink);
    doc.rect(MARGIN, y, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.ink);
    doc.text(texto, MARGIN + 6, y + 6);
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