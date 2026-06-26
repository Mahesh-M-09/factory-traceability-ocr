import type { DemoTraceRecord, OperationRecord, ReworkLogRecord } from "../types/config";

const DEMO_DATABASE_KEY = "factoryTraceabilityDemoRecords";

const BASE_COLUMNS = [
  "serialNumber",
  "material",
  "part",
  "batchNumber",
  "status",
  "requiresInvestigation",
  "linkedHingeSerial",
  "createdAt",
  "updatedAt",
  "lastOperation",
  "lastOperator",
  "lastJig",
  "lastRobot",
  "lastCycleTimeSeconds",
  "operationCount",
  "reworkLog"
];

export function loadDemoRecords(): DemoTraceRecord[] {
  const saved = window.localStorage.getItem(DEMO_DATABASE_KEY);
  if (!saved) {
    return [];
  }

  try {
    const records = JSON.parse(saved) as DemoTraceRecord[];
    return Array.isArray(records) ? records.map(normalizeRecord) : [];
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

export function hasOperationSubmission(serialNumber: string, operation: string) {
  const record = findDemoRecord(serialNumber);
  return Boolean(record?.events.some((event) => event.operation.toLowerCase() === operation.toLowerCase()));
}

export function flagRecordForInvestigation(serialNumber: string, reason: string, operatorId = "") {
  const needle = serialNumber.trim().toUpperCase();
  const now = new Date().toISOString();
  const records = loadDemoRecords();
  const nextRecords = records.map((record) => {
    if (record.serialNumber.toUpperCase() !== needle) {
      return record;
    }
    return {
      ...record,
      requiresInvestigation: true,
      updatedAt: now,
      columns: {
        ...(record.columns ?? {}),
        InvestigationReason: reason,
        InvestigationTime: now,
        InvestigationRaisedBy: operatorId
      }
    };
  });
  persistDemoRecords(nextRecords);
}

export function addManualDemoRecord(input: {
  serialNumber: string;
  material: string;
  part: string;
  batchNumber?: string;
  requiresInvestigation: boolean;
  addedBy?: string;
  notes?: string;
}) {
  const serialNumber = input.serialNumber.trim().toUpperCase();
  const now = new Date().toISOString();
  const records = loadDemoRecords();
  const existing = records.find((record) => record.serialNumber.toUpperCase() === serialNumber);
  const nextRecord: DemoTraceRecord = {
    ...(existing ?? {
      serialNumber,
      linkedHingeSerial: "",
      createdAt: now,
      columns: {},
      reworkLog: [],
      events: []
    }),
    serialNumber,
    material: input.material,
    part: input.part,
    tableName: getTableName(input.material, input.part),
    batchNumber: input.batchNumber ?? existing?.batchNumber ?? "Manual",
    status: existing?.status ?? "Active",
    requiresInvestigation: input.requiresInvestigation,
    updatedAt: now
  };
  nextRecord.columns = {
    ...(nextRecord.columns ?? {}),
    ManualAddedBy: input.addedBy ?? "",
    ManualAddNotes: input.notes ?? "",
    ManualAddTime: now
  };
  persistDemoRecords([...records.filter((record) => record.serialNumber.toUpperCase() !== serialNumber), nextRecord]);
}

export function deleteDemoRecord(serialNumber: string) {
  const needle = serialNumber.trim().toUpperCase();
  persistDemoRecords(loadDemoRecords().filter((record) => record.serialNumber.toUpperCase() !== needle));
}

export function getDemoTables(records = loadDemoRecords()) {
  return Array.from(new Set(records.map((record) => record.tableName))).sort();
}

export function exportDemoRecordsCsv(records = loadDemoRecords()) {
  const columns = getCsvColumns(records);
  const rows = records.map((record) =>
    columns.map((column) => csvEscape(readCsvValue(record, column))).join(",")
  );
  return [columns.join(","), ...rows].join("\n");
}

export function getOperationHistory(records = loadDemoRecords()) {
  return records.flatMap((record) =>
    record.events.map((event) => ({
      id: event.id ?? createEventId(event, event.serialNumber),
      serialNumber: event.serialNumber,
      tableName: record.tableName,
      material: record.material,
      part: record.part,
      operation: event.operation,
      operatorId: event.operatorId,
      jig: event.formValues.jigUsed ?? event.formValues.jigCapture ?? "",
      robot: event.formValues.robotNumber ?? event.formValues.robotUsed ?? "",
      result: event.formValues.partStatus ?? event.formValues.passFail ?? event.formValues.reworkStatus ?? event.formValues.scrapStatus ?? "",
      cycleTimeSeconds: event.cycleTimeSeconds ?? 0,
      timestamp: event.dateTime,
      notes: event.formValues.notes ?? "",
      extraFields: JSON.stringify(event.formValues)
    }))
  );
}

export function getReworkHistory(records = loadDemoRecords()): ReworkLogRecord[] {
  return records.flatMap((record) =>
    record.reworkLog.map((entry, index) => ({
      id: `${record.serialNumber}-rework-${index}`,
      serialNumber: record.serialNumber,
      material: record.material,
      part: record.part,
      tableName: record.tableName,
      sourceOperation: readReworkSegment(entry, "operation") || "Unknown",
      reason: readReworkSegment(entry, "reason") || entry,
      notes: readReworkSegment(entry, "notes"),
      status: readReworkSegment(entry, "status") || "Open",
      openedBy: readReworkSegment(entry, "operator"),
      openedAt: readReworkSegment(entry, "time"),
      closedBy: "",
      closedAt: ""
    }))
  );
}

export function exportOperationHistoryCsv(records = loadDemoRecords()) {
  const columns = ["serialNumber", "tableName", "material", "part", "operation", "operatorId", "jig", "robot", "result", "cycleTimeSeconds", "timestamp", "notes", "extraFields"];
  return [
    columns.join(","),
    ...getOperationHistory(records).map((row) => columns.map((column) => csvEscape(String(row[column as keyof typeof row] ?? ""))).join(","))
  ].join("\n");
}

export function exportReworkHistoryCsv(records = loadDemoRecords()) {
  const columns = ["serialNumber", "tableName", "material", "part", "sourceOperation", "reason", "notes", "status", "openedBy", "openedAt"];
  return [
    columns.join(","),
    ...getReworkHistory(records).map((row) => columns.map((column) => csvEscape(String(row[column as keyof typeof row] ?? ""))).join(","))
  ].join("\n");
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
      tableName: getTableName(record.material, record.part),
      batchNumber: record.formValues.batchNumber || `${startSerial}-${endSerial}`,
      status: record.formValues.scrapStatus === "Scrap" ? "Scrap" : record.formValues.scrapStatus === "Hold" ? "Hold" : existing?.status || "Active",
      requiresInvestigation: existing?.requiresInvestigation ?? false,
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
    tableName: existing?.tableName ?? getTableName(record.material, record.part),
    batchNumber: existing?.batchNumber ?? record.formValues.batchNumber ?? "",
    status,
    requiresInvestigation: existing?.requiresInvestigation ?? false,
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
  if (record.formValues.reworkAction === "Scrap" || record.formValues.scrapStatus === "Scrap" || record.formValues.reworkStatus === "Scrap") {
    return "Scrap";
  }
  if (record.formValues.reworkAction === "Return to active") {
    return "Active";
  }
  if (record.formValues.sendToRework === "Yes" || record.formValues.reworkAction === "Keep in rework" || record.formValues.scrapStatus === "Rework") {
    return "Rework";
  }
  if (record.formValues.scrapStatus === "Hold" || record.formValues.partStatus === "Not OK" || record.formValues.passFail === "Fail") {
    return "Hold";
  }
  return currentStatus === "New" ? "Active" : currentStatus;
}

export function getTableName(material: string, part: string) {
  return `${material}_${part}`.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function buildReworkEntry(record: OperationRecord) {
  const sendToRework = record.formValues.sendToRework === "Yes" || Boolean(record.formValues.reworkAction);
  const value = record.formValues.reworkReason || record.formValues.reworkEntry || "";
  if (!sendToRework && (!value || value === "No Rework")) {
    return "";
  }
  const action = record.formValues.reworkAction || "Open";
  const status = action === "Return to active" ? "Closed - Active" : action === "Scrap" ? "Closed - Scrap" : "Open";
  return [
    `operation=${record.operation}`,
    `reason=${value || "Rework requested"}`,
    `notes=${record.formValues.reworkEntry || record.formValues.notes || "No notes"}`,
    `status=${status}`,
    `action=${action}`,
    `operator=${record.operatorId}`,
    `time=${record.dateTime}`
  ].join("; ");
}

function readReworkSegment(entry: string, key: string) {
  const segment = entry
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}=`));
  return segment ? segment.slice(key.length + 1).trim() : "";
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
  return [...BASE_COLUMNS, ...dynamicColumns, "tableName"];
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
  if (column === "operationCount") {
    return String(record.events.length);
  }
  if (column === "reworkLog") {
    return record.reworkLog.join(" | ");
  }
  if (column === "requiresInvestigation") {
    return record.requiresInvestigation ? "TRUE" : "FALSE";
  }
  const baseValue = readBaseColumn(record, column);
  if (baseValue !== null) {
    return baseValue;
  }
  return record.columns[column] ?? "";
}

function readBaseColumn(record: DemoTraceRecord, column: string) {
  switch (column) {
    case "serialNumber":
      return record.serialNumber;
    case "material":
      return record.material;
    case "part":
      return record.part;
    case "batchNumber":
      return record.batchNumber;
    case "status":
      return record.status;
    case "linkedHingeSerial":
      return record.linkedHingeSerial;
    case "createdAt":
      return record.createdAt;
    case "updatedAt":
      return record.updatedAt;
    case "tableName":
      return record.tableName;
    default:
      return null;
  }
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
    headers.filter((header) => !BASE_COLUMNS.includes(header) && header !== "tableName").map((header) => [header, values[header] ?? ""])
  );
  return {
    serialNumber: values.serialNumber ?? "",
    material: values.material ?? "",
    part: values.part ?? "",
    tableName: values.tableName || getTableName(values.material ?? "", values.part ?? ""),
    batchNumber: values.batchNumber ?? "",
    status: values.status ?? "Active",
    requiresInvestigation: values.requiresInvestigation?.toUpperCase() === "TRUE",
    linkedHingeSerial: values.linkedHingeSerial ?? "",
    createdAt: values.createdAt ?? new Date().toISOString(),
    updatedAt: values.updatedAt ?? new Date().toISOString(),
    columns,
    reworkLog: values.reworkLog ? values.reworkLog.split("|").map((item) => item.trim()).filter(Boolean) : [],
    events: []
  };
}

function normalizeRecord(record: DemoTraceRecord): DemoTraceRecord {
  return {
    ...record,
    tableName: record.tableName || getTableName(record.material, record.part),
    requiresInvestigation: Boolean(record.requiresInvestigation),
    columns: record.columns ?? {},
    reworkLog: record.reworkLog ?? [],
    events: record.events ?? []
  };
}
