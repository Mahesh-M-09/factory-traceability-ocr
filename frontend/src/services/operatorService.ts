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

  return config.employees.includes(operatorId);
}
