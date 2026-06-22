import type { DemoTraceRecord, OperationRecord } from "../types/config";

const DEMO_DATABASE_KEY = "factoryTraceabilityDemoRecords";

const BASE_COLUMNS = [
  "serialNumber",
  "material",
  "part",
  "batchNumber",
  "status",
  "linkedHingeSerial",
  "createdAt",
  "updatedAt",
  "lastOperation",
  "lastOperator",
  "lastJig",
  "lastRobot",
  "lastCycleTimeSeconds",
  "reworkLog"
];

export function loadDemoRecords(): DemoTraceRecord[] {
  const saved = window.localStorage.getItem(DEMO_DATABASE_KEY);
  if (!saved) {
    return [];
  }

  try {
    const records = JSON.parse(saved) as DemoTraceRecord[];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export function saveDemoOperation(record: OperationRecord) {
  const records = loadDemoRecords();
  const savedRecords = isStampingRecord(record) ? saveStampingBatch(records, record) : saveSingleOperation(records, record);
  persistDemoRecords(savedRecords);
  return {
    success: true,
    message: `${savedRecords.length} demo database row${savedRecords.length === 1 ? "" : "s"} available.`
  };
}

export function findDemoRecord(serialNumber: string) {
  const needle = serialNumber.trim().toUpperCase();
  return loadDemoRecords().find((record) => record.serialNumber.toUpperCase() === needle);
}

export function exportDemoRecordsCsv(records = loadDemoRecords()) {
  const columns = getCsvColumns(records);
  const rows = records.map((record) =>
    columns.map((column) => csvEscape(readCsvValue(record, column))).join(",")
  );
  return [columns.join(","), ...rows].join("\n");
}

export function importDemoRecordsCsv(csvText: string) {
  const [headerRow, ...rows] = parseCsv(csvText.trim());
  if (!headerRow || headerRow.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const records = rows
    .filter((row) => row.some(Boolean))
    .map((row) => rowToRecord(headerRow, row))
    .filter((record) => record.serialNumber);

  persistDemoRecords(records);
  return records.length;
}

export function clearDemoRecords() {
  window.localStorage.removeItem(DEMO_DATABASE_KEY);
}

function saveStampingBatch(records: DemoTraceRecord[], record: OperationRecord) {
  const startSerial = record.formValues.startSerial || record.formValues.fromSerial || record.serialNumber;
  const endSerial = record.formValues.endSerial || record.formValues.toSerial || startSerial;
  const serials = expandSerialRange(startSerial, endSerial);
  const now = record.dateTime;
  const bySerial = new Map(records.map((item) => [item.serialNumber, item]));

  serials.forEach((serialNumber) => {
    const existing = bySerial.get(serialNumber);
    const event = { ...record, serialNumber, id: createEventId(record, serialNumber) };
    bySerial.set(serialNumber, {
      serialNumber,
      material: record.material,
      part: record.part,
      batchNumber: record.formValues.batchNumber || `${startSerial}-${endSerial}`,
      status: record.formValues.scrapStatus === "Scrap" ? "Scrap" : existing?.status || "Active",
      linkedHingeSerial: existing?.linkedHingeSerial ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      columns: {
        ...(existing?.columns ?? {}),
        StampingOperator: record.operatorId,
        StampingTime: now,
        StampingBatch: record.formValues.batchNumber || `${startSerial}-${endSerial}`
      },
      reworkLog: existing?.reworkLog ?? [],
      events: [...(existing?.events ?? []), event]
    });
  });

  return Array.from(bySerial.values()).sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
}

function saveSingleOperation(records: DemoTraceRecord[], record: OperationRecord) {
  const serialNumber = record.serialNumber.trim().toUpperCase();
  const existing = records.find((item) => item.serialNumber.toUpperCase() === serialNumber);
  const others = records.filter((item) => item.serialNumber.toUpperCase() !== serialNumber);
  const operationKey = keyFromLabel(record.operation);
  const status = resolveStatus(record, existing?.status ?? "Active");
  const reworkEntry = buildReworkEntry(record);
  const event = { ...record, id: createEventId(record, serialNumber) };

  const nextRecord: DemoTraceRecord = {
    serialNumber,
    material: existing?.material ?? record.material,
    part: existing?.part ?? record.part,
    batchNumber: existing?.batchNumber ?? record.formValues.batchNumber ?? "",
    status,
    linkedHingeSerial: record.linkedHingeSerial || existing?.linkedHingeSerial || record.formValues.hingeSerial || "",
    createdAt: existing?.createdAt ?? record.dateTime,
    updatedAt: record.dateTime,
    columns: {
      ...(existing?.columns ?? {}),
      [`${operationKey}Operator`]: record.operatorId,
      [`${operationKey}Time`]: record.dateTime,
      [`${operationKey}Jig`]: record.formValues.jigUsed ?? "",
      [`${operationKey}Robot`]: record.formValues.robotNumber ?? record.formValues.robotUsed ?? "",
      [`${operationKey}CycleTimeSeconds`]: String(record.cycleTimeSeconds ?? ""),
      [`${operationKey}Result`]: record.formValues.partStatus ?? record.formValues.passFail ?? record.formValues.reworkStatus ?? ""
    },
    reworkLog: reworkEntry ? [...(existing?.reworkLog ?? []), reworkEntry] : existing?.reworkLog ?? [],
    events: [...(existing?.events ?? []), event]
  };

  return [...others, nextRecord].sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
}

function isStampingRecord(record: OperationRecord) {
  return record.operation.toLowerCase().includes("stamping") && Boolean(record.formValues.startSerial || record.formValues.endSerial);
}

function expandSerialRange(startSerial: string, endSerial: string) {
  const start = splitSerial(startSerial);
  const end = splitSerial(endSerial);
  if (!start || !end || start.prefix !== end.prefix || start.width !== end.width || end.number < start.number) {
    return [startSerial.trim().toUpperCase()].filter(Boolean);
  }

  const serials: string[] = [];
  for (let value = start.number; value <= end.number; value += 1) {
    serials.push(`${start.prefix}${String(value).padStart(start.width, "0")}`);
  }
  return serials;
}

function splitSerial(value: string) {
  const match = value.trim().toUpperCase().match(/^([A-Z]*)(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    prefix: match[1],
    number: Number(match[2]),
    width: match[2].length
  };
}

function resolveStatus(record: OperationRecord, currentStatus: string) {
  if (record.formValues.scrapStatus === "Scrap" || record.formValues.reworkStatus === "Scrap" || record.formValues.partStatus === "Fail") {
    return "Scrap";
  }
  if (record.formValues.partStatus === "Not OK" || record.formValues.passFail === "Fail") {
    return "Hold";
  }
  return currentStatus === "New" ? "Active" : currentStatus;
}

function buildReworkEntry(record: OperationRecord) {
  const value = record.formValues.reworkEntry || record.formValues.reworkStatus || "";
  if (!value || value === "No Rework") {
    return "";
  }
  return `[${record.operation}] ${value} - ${record.formValues.notes || "No action notes"} (${record.operatorId}, ${record.dateTime})`;
}

function keyFromLabel(label: string) {
  return label
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+(\w)/g, (_match: string, letter: string) => letter.toUpperCase())
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function createEventId(record: OperationRecord, serialNumber: string) {
  return `${serialNumber}-${record.operation}-${record.dateTime}`.replace(/\s+/g, "-");
}

function persistDemoRecords(records: DemoTraceRecord[]) {
  window.localStorage.setItem(DEMO_DATABASE_KEY, JSON.stringify(records, null, 2));
}

function getCsvColumns(records: DemoTraceRecord[]) {
  const dynamicColumns = Array.from(new Set(records.flatMap((record) => Object.keys(record.columns)))).sort();
  return [...BASE_COLUMNS, ...dynamicColumns];
}

function readCsvValue(record: DemoTraceRecord, column: string) {
  if (column === "lastOperation") {
    return record.events.at(-1)?.operation ?? "";
  }
  if (column === "lastOperator") {
    return record.events.at(-1)?.operatorId ?? "";
  }
  if (column === "lastJig") {
    return record.events.at(-1)?.formValues.jigUsed ?? "";
  }
  if (column === "lastRobot") {
    return record.events.at(-1)?.formValues.robotNumber ?? record.events.at(-1)?.formValues.robotUsed ?? "";
  }
  if (column === "lastCycleTimeSeconds") {
    return String(record.events.at(-1)?.cycleTimeSeconds ?? "");
  }
  if (column === "reworkLog") {
    return record.reworkLog.join(" | ");
  }
  if (column in record) {
    return String(record[column as keyof DemoTraceRecord] ?? "");
  }
  return record.columns[column] ?? "";
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsv(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function rowToRecord(headers: string[], row: string[]): DemoTraceRecord {
  const values = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
  const columns = Object.fromEntries(
    headers.filter((header) => !BASE_COLUMNS.includes(header)).map((header) => [header, values[header] ?? ""])
  );
  return {
    serialNumber: values.serialNumber ?? "",
    material: values.material ?? "",
    part: values.part ?? "",
    batchNumber: values.batchNumber ?? "",
    status: values.status ?? "Active",
    linkedHingeSerial: values.linkedHingeSerial ?? "",
    createdAt: values.createdAt ?? new Date().toISOString(),
    updatedAt: values.updatedAt ?? new Date().toISOString(),
    columns,
    reworkLog: values.reworkLog ? values.reworkLog.split("|").map((item) => item.trim()).filter(Boolean) : [],
    events: []
  };
}
