import type { ProductionTarget } from "../types/config";

const TARGET_STORAGE_KEY = "factoryTraceabilityTargets";

export function loadProductionTargets(): ProductionTarget[] {
  const saved = window.localStorage.getItem(TARGET_STORAGE_KEY);
  if (!saved) {
    return [];
  }

  try {
    const targets = JSON.parse(saved) as ProductionTarget[];
    return Array.isArray(targets) ? targets : [];
  } catch {
    return [];
  }
}

export function saveProductionTarget(target: Omit<ProductionTarget, "id" | "updatedAt"> & { id?: string }) {
  const targets = loadProductionTargets();
  const id = target.id || createTargetId(target);
  const nextTarget: ProductionTarget = {
    ...target,
    id,
    updatedAt: new Date().toISOString()
  };
  const nextTargets = [nextTarget, ...targets.filter((item) => item.id !== id)];
  window.localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(nextTargets, null, 2));
  return nextTarget;
}

export function saveProductionTargets(targetsToSave: Array<Omit<ProductionTarget, "id" | "updatedAt"> & { id?: string }>) {
  let targets = loadProductionTargets();
  const saved = targetsToSave.map((target) => ({
    ...target,
    id: target.id || createTargetId(target),
    updatedAt: new Date().toISOString()
  }));
  saved.forEach((target) => {
    targets = [target, ...targets.filter((item) => item.id !== target.id)];
  });
  window.localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(targets, null, 2));
  return saved;
}

export function parseProductionTargetCsv(csvText: string) {
  const [headers, ...rows] = parseCsv(csvText.trim());
  if (!headers?.length) {
    throw new Error("Target CSV is empty.");
  }
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => {
      const value = (name: string) => row[normalizedHeaders.indexOf(name)]?.trim() ?? "";
      return {
        material: value("material"),
        part: value("part"),
        operation: value("operation"),
        targetQty: Number(value("targetqty") || value("target") || 0),
        shift: value("shift") || "Day",
        notes: value("notes")
      };
    })
    .filter((row) => row.material && row.part && row.operation && row.targetQty > 0);
}

export function getDateKeysInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(getTodayKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function deleteProductionTarget(targetId: string) {
  window.localStorage.setItem(
    TARGET_STORAGE_KEY,
    JSON.stringify(loadProductionTargets().filter((target) => target.id !== targetId), null, 2)
  );
}

export function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(isoDate: string, dayKey: string) {
  if (!isoDate) {
    return false;
  }
  return getTodayKey(new Date(isoDate)) === dayKey;
}

function createTargetId(target: Pick<ProductionTarget, "date" | "shift" | "material" | "part" | "operation">) {
  return [target.date, target.shift, target.material, target.part, target.operation]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
