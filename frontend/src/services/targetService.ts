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
