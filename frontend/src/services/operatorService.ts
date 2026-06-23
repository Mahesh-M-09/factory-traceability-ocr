import type { AppConfig } from "../types/config";

export function getStoredOperatorId() {
  return window.sessionStorage.getItem("operatorId") ?? "";
}

export function storeOperatorId(operatorId: string) {
  window.sessionStorage.setItem("operatorId", operatorId);
}

export function clearOperatorId() {
  window.sessionStorage.removeItem("operatorId");
}

export async function validateOperatorId(operatorId: string, config: AppConfig) {
  if (!/^\d{4}$/.test(operatorId)) {
    return false;
  }

  const employeeApiUrl = import.meta.env.VITE_EMPLOYEE_API_URL as string | undefined;
  if (employeeApiUrl) {
    const response = await fetch(`${employeeApiUrl.replace(/\/$/, "")}/${operatorId}`);
    if (!response.ok) {
      return false;
    }
    const result = (await response.json()) as { active?: boolean };
    return result.active === true;
  }

  return config.employees.includes(operatorId) || Boolean(config.users?.some((user) => user.id === operatorId));
}

export function getConfiguredUser(operatorId: string, config: AppConfig) {
  return config.users?.find((user) => user.id === operatorId);
}

export function canAccessMaterial(operatorId: string, materialId: string, config: AppConfig) {
  const user = getConfiguredUser(operatorId, config);
  if (!user || user.access.length === 0) {
    return true;
  }
  return user.access.some((access) => access.materialId === materialId);
}

export function canAccessPart(operatorId: string, materialId: string, partId: string, config: AppConfig) {
  const user = getConfiguredUser(operatorId, config);
  if (!user || user.access.length === 0) {
    return true;
  }
  return user.access.some((access) => access.materialId === materialId && access.partId === partId);
}

export function canAccessOperation(operatorId: string, materialId: string, partId: string, operationId: string, config: AppConfig) {
  const user = getConfiguredUser(operatorId, config);
  if (!user || user.access.length === 0) {
    return true;
  }
  return user.access.some(
    (access) =>
      access.materialId === materialId &&
      access.partId === partId &&
      (access.operationIds.length === 0 || access.operationIds.includes(operationId))
  );
}

export function canManuallyAddSerial(operatorId: string, config: AppConfig) {
  const role = getConfiguredUser(operatorId, config)?.role;
  return role === "teamLead" || role === "admin";
}
