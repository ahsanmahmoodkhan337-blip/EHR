/**
 * Claim form PDF — draws the *boxed* claim form, not a field table.
 *
 * One renderer for both papers: it walks the layout data
 * (`cms1500Layout.ts` / `adaLayout.ts`) row by row, draws each box in the
 * form's red-brown rule colour, and writes each box's value inside its own
 * box. The same layout that positions the on-screen paper positions the PDF,
 * so the two cannot drift apart.
 *
 * Inspiration: the "print claim form" output of a clearinghouse portal — a
 * faithful CMS-1500 / ADA 2019 sheet, not a summary.
 */

import jsPDF from "jspdf";
import type { ClaimLayout } from "../data/claims/cms1500Layout";
import { DIAGNOSIS_POINTERS } from "../data/claims/cms1500Layout";

/** The CMS-1500 / ADA printed rule colour (red-brown). */
const FORM_RED: [number, number, number] = [163, 58, 43];
const INK: [number, number, number] = [23, 23, 23];

export interface ClaimPdfColumn {
  key: string;
  label: string;
  /** Share of the table width (sums to 1). */
  width: number;
  kind?: "text" | "money" | "date" | "number";
}

export interface ClaimPdfOptions {
  layout: ClaimLayout;
  values: Record<string, unknown>;
  lines: Record<string, unknown>[];
  columns: ClaimPdfColumn[];
  fileName: string;
  note?: string;
}

const isBlank = (v: unknown): boolean => String(v ?? "").trim() === "";

function formatValue(value: unknown, kind?: ClaimPdfColumn["kind"]): string {
  if (typeof value === "boolean") return value ? "X" : "";
  if (Array.isArray(value)) return value.filter((v) => !isBlank(v)).join(", ");
  if (value === null || value === undefined) return "";
  if (kind === "money") {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(n) && n !== 0 ? n.toFixed(2) : "";
  }
  const text = String(value);
  if (kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split("-");
    return `${m}/${d}/${y}`;
  }
  return text;
}

export function exportClaimFormPDF({
  layout,
  values,
  lines,
  columns,
  fileName,
  note,
}: ClaimPdfOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const margin = 8;
  const usableW = pageW - margin * 2;
  const totalMm = layout.rows.reduce((sum, r) => sum + r.heightMm, 0);
  const scale = Math.min(1, (pageH - margin * 2 - 8) / totalMm);

  // Title band
  doc.setTextColor(...FORM_RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(layout.title, margin, margin + 3);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(`${layout.formCode} — Healthcare Hustlers teaching replica (demo data, not a real claim)`, margin, margin + 6.5);
  doc.setDrawColor(...FORM_RED);
  doc.setLineWidth(0.5);
  doc.line(margin, margin + 7.6, pageW - margin, margin + 7.6);

  let y = margin + 8.5;

  const drawBox = (
    x: number,
    yy: number,
    w: number,
    h: number,
    label: string,
    body: (bx: number, by: number, bw: number) => void,
    band = false,
  ) => {
    doc.setDrawColor(...FORM_RED);
    doc.setLineWidth(0.25);
    if (band) {
      doc.setFillColor(247, 232, 228);
      doc.rect(x, yy, w, h, "FD");
      doc.setTextColor(...FORM_RED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.6);
      doc.text(doc.splitTextToSize(label, w - 2).slice(0, 1), x + 1, yy + h / 2 + 1);
      return;
    }
    doc.rect(x, yy, w, h);

    doc.setTextColor(...FORM_RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.2);
    const labelLines = doc.splitTextToSize(label, w - 1.6).slice(0, 2) as string[];
    labelLines.forEach((line, i) => doc.text(line, x + 0.8, yy + 2.4 + i * 1.7));

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "normal");
    body(x + 0.8, yy + 2.4 + labelLines.length * 1.7 + 1.4, w - 1.6);
  };

  const drawValues = (bx: number, by: number, bw: number, text: string, size = 6) => {
    if (isBlank(text)) return;
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, bw) as string[];
    wrapped.slice(0, 3).forEach((line, i) => doc.text(line, bx, by + i * (size * 0.42)));
  };

  for (const row of layout.rows) {
    const rowH = row.heightMm * scale;
    let x = margin;
    for (const cell of row.cells) {
      const w = (usableW * cell.colSpan) / 12;

      if (cell.structural === "band") {
        drawBox(x, y, w, rowH, cell.label, () => {}, true);
      } else if (cell.structural === "pointerGrid") {
        drawBox(x, y, w, rowH, cell.label, (bx, by, bw) => {
          const codes = (values.diagnosisCodes as string[]) ?? [];
          const colW = bw / 6;
          DIAGNOSIS_POINTERS.forEach((letter, i) => {
            const col = i % 6;
            const line = Math.floor(i / 6);
            const text = codes[i] ? `${letter}. ${codes[i]}` : `${letter}.`;
            doc.setFontSize(5.4);
            doc.text(text, bx + col * colW, by + line * 3.4);
          });
        });
      } else if (cell.structural === "table") {
        drawBox(x, y, w, rowH, cell.label, (bx, by, bw) => {
          // header
          doc.setFont("helvetica", "bold");
          doc.setFontSize(4.2);
          let cx = bx;
          columns.forEach((col) => {
            const cw = bw * col.width;
            doc.text(doc.splitTextToSize(col.label, cw - 0.6).slice(0, 1) as string[], cx, by);
            cx += cw;
          });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5);
          const rowH2 = Math.min(4.2, (rowH - 8) / Math.max(1, lines.length || 1));
          lines.forEach((line, li) => {
            let lx = bx;
            columns.forEach((col) => {
              const cw = bw * col.width;
              const text = formatValue(line[col.key], col.kind);
              if (text) doc.text(doc.splitTextToSize(text, cw - 0.8).slice(0, 1) as string[], lx, by + 4.4 + li * rowH2);
              lx += cw;
            });
          });
        });
      } else if (cell.checks || cell.fields) {
        drawBox(x, y, w, rowH, cell.label, (bx, by, bw) => {
          // Two independent branches, not else-if: box 10 prints its three
          // checks AND 10d's claim codes in the one cell, so the codes have to
          // reach the PDF under the checkboxes.
          let bodyY = by;
          if (cell.checks) {
            doc.setFontSize(5.2);
            cell.checks.forEach((check, i) => {
              const marked = values[check.field] ? "X" : " ";
              doc.text(`[${marked}] ${check.label}`, bx, by + i * 3.1);
            });
            bodyY = by + cell.checks.length * 3.1 + 1;
          }
          if (cell.fields) {
            if (cell.stack) {
              // A stacked box prints its values one above the other — box 22's
              // resubmission code with ORIGINAL REF. NO. beneath it.
              let fy = bodyY;
              cell.fields.forEach((field) => {
                if (field.label) {
                  doc.setFontSize(3.6);
                  doc.text(field.label, bx, fy);
                  fy += 2.1;
                }
                const text = formatValue(
                  values[field.field],
                  field.kind === "money" ? "money" : field.kind === "date" ? "date" : undefined,
                );
                drawValues(bx, fy, bw - 1, text);
                fy += 3.2;
              });
              return;
            }
            const flexTotal = cell.fields.reduce((s, f) => s + (f.flex ?? 1), 0);
            let fx = bx;
            cell.fields.forEach((field) => {
              const fw = (bw * (field.flex ?? 1)) / flexTotal;
              const text = formatValue(values[field.field], field.kind === "money" ? "money" : field.kind === "date" ? "date" : undefined);
              drawValues(fx, bodyY, fw - 1, text);
              fx += fw;
            });
          }
        });
      } else if (cell.reserved) {
        // A box the 02/12 prints shaded and reserved: caption, no value.
        doc.setDrawColor(...FORM_RED);
        doc.setLineWidth(0.25);
        doc.setFillColor(244, 236, 234);
        doc.rect(x, y, w, rowH, "FD");
        doc.setTextColor(...FORM_RED);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.2);
        doc.text(
          doc.splitTextToSize(cell.label, w - 1.6).slice(0, 2) as string[],
          x + 0.8,
          y + 2.4,
        );
      } else {
        drawBox(x, y, w, rowH, cell.label, () => {});
      }

      x += w;
    }
    y += rowH;
  }

  if (note) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(4.6);
    doc.text(note, margin, y + 3);
  }

  doc.save(fileName);
}
