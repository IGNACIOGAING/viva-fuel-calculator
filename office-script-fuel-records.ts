/**
 * Viva Aerobus — Fuel discrepancy records
 * Office Script for the SharePoint Excel.
 *
 * Acciones:
 *   - { action: "add",  record: { ... } }   → agrega 1 fila debajo de los títulos
 *   - { action: "list" }                    → devuelve todos los registros
 *
 * Layout en la hoja:
 *   A4..K4   = títulos
 *   A5..K…   = registros (1 por fila)
 *
 * Se invoca desde Power Automate con la acción
 *   "Excel Online (Business) → Run script"
 * pasándole el body crudo del HTTP trigger en el parámetro `payloadJson`.
 *
 * Devuelve un string JSON que el flow reenvía al cliente.
 */

const HEADER_ROW = 4;
const FIRST_DATA_ROW = HEADER_ROW + 1;
const COLS = 11;
const LAST_COL_LETTER = "K";

const HEADERS: string[] = [
  "Timestamp",
  "Flight",
  "FR (kg)",
  "FOB (kg)",
  "Total (kg)",
  "Density (kg/L)",
  "Total (L)",
  "Low end (L)",
  "High end (L)",
  "Status",
  "ID",
];

interface FuelRecord {
  timestamp: string;
  flight: string;
  fr: number | string;
  fob: number | string;
  totalKg: number | string;
  density: number | string;
  totalL: number | string;
  lowL: number | string;
  highL: number | string;
  status: string;
  id: string;
}

function main(workbook: ExcelScript.Workbook, payloadJson: string): string {
  let payload: { action?: string; record?: FuelRecord };
  try {
    payload = JSON.parse(payloadJson || "{}");
  } catch (e) {
    return JSON.stringify({ ok: false, error: "Invalid JSON payload" });
  }

  const sheet = workbook.getActiveWorksheet();
  ensureHeaders(sheet);

  const action = (payload.action || "").toLowerCase();

  if (action === "add") {
    if (!payload.record) {
      return JSON.stringify({ ok: false, error: "Missing 'record'" });
    }
    return JSON.stringify(addRecord(sheet, payload.record));
  }

  if (action === "list") {
    return JSON.stringify({ ok: true, records: listRecords(sheet) });
  }

  return JSON.stringify({ ok: false, error: "Unknown action: " + action });
}

/** Asegura que A4..K4 tenga los títulos correctos (los pisa si están vacíos o distintos). */
function ensureHeaders(sheet: ExcelScript.Worksheet): void {
  const range = sheet.getRange(`A${HEADER_ROW}:${LAST_COL_LETTER}${HEADER_ROW}`);
  const current = range.getValues()[0] as (string | number)[];
  let needsWrite = false;
  for (let i = 0; i < HEADERS.length; i++) {
    if (String(current[i] || "").trim() !== HEADERS[i]) {
      needsWrite = true;
      break;
    }
  }
  if (needsWrite) {
    range.setValues([HEADERS]);
    const fmt = range.getFormat();
    fmt.getFont().setBold(true);
    fmt.getFill().setColor("#0A0E0A");
    fmt.getFont().setColor("#FFFFFF");
  }
}

/** Calcula la primera fila vacía a partir de FIRST_DATA_ROW mirando la columna A. */
function findNextEmptyRow(sheet: ExcelScript.Worksheet): number {
  const used = sheet.getUsedRange(true);
  if (!used) return FIRST_DATA_ROW;
  const lastUsedRow = used.getRowIndex() + used.getRowCount(); // 1-based row after last used
  return Math.max(lastUsedRow + 1, FIRST_DATA_ROW);
}

/** Devuelve el set de IDs ya cargados (para idempotencia). */
function existingIds(sheet: ExcelScript.Worksheet): { [id: string]: boolean } {
  const next = findNextEmptyRow(sheet);
  const out: { [id: string]: boolean } = {};
  if (next <= FIRST_DATA_ROW) return out;
  const range = sheet.getRange(`K${FIRST_DATA_ROW}:K${next - 1}`);
  const values = range.getValues();
  for (let i = 0; i < values.length; i++) {
    const v = String(values[i][0] || "").trim();
    if (v) out[v] = true;
  }
  return out;
}

/** Agrega un registro al final. Devuelve { ok, row, duplicate? }. */
function addRecord(
  sheet: ExcelScript.Worksheet,
  rec: FuelRecord
): { ok: boolean; row?: number; duplicate?: boolean; error?: string } {
  if (!rec.id) return { ok: false, error: "record.id required" };

  const ids = existingIds(sheet);
  if (ids[rec.id]) {
    return { ok: true, duplicate: true };
  }

  const row = findNextEmptyRow(sheet);
  const target = sheet.getRange(`A${row}:${LAST_COL_LETTER}${row}`);
  target.setValues([
    [
      rec.timestamp || "",
      rec.flight || "",
      toNum(rec.fr),
      toNum(rec.fob),
      toNum(rec.totalKg),
      toNum(rec.density),
      toNum(rec.totalL),
      toNum(rec.lowL),
      toNum(rec.highL),
      rec.status || "",
      rec.id,
    ],
  ]);
  return { ok: true, row };
}

/** Devuelve todos los registros desde FIRST_DATA_ROW hacia abajo. */
function listRecords(sheet: ExcelScript.Worksheet): FuelRecord[] {
  const next = findNextEmptyRow(sheet);
  if (next <= FIRST_DATA_ROW) return [];
  const range = sheet.getRange(
    `A${FIRST_DATA_ROW}:${LAST_COL_LETTER}${next - 1}`
  );
  const values = range.getValues();
  const out: FuelRecord[] = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    if (!r[0] && !r[10]) continue;
    out.push({
      timestamp: String(r[0] || ""),
      flight: String(r[1] || ""),
      fr: toNum(r[2]),
      fob: toNum(r[3]),
      totalKg: toNum(r[4]),
      density: toNum(r[5]),
      totalL: toNum(r[6]),
      lowL: toNum(r[7]),
      highL: toNum(r[8]),
      status: String(r[9] || ""),
      id: String(r[10] || ""),
    });
  }
  return out;
}

function toNum(v: string | number | boolean): number | string {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isFinite(n) ? n : v;
  }
  return v as unknown as number;
}
