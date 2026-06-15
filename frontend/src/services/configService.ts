import type { AppConfig } from "../types/config";

const CONFIG_STORAGE_KEY = "factoryTraceabilityConfig";

export async function loadAppConfig(): Promise<AppConfig> {
  const saved = window.localStorage.getItem(CONFIG_STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved) as AppConfig;
  }

  const response = await fetch("config/app-config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load app configuration.");
  }

  return (await response.json()) as AppConfig;
}

export function saveAppConfig(config: AppConfig) {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config, null, 2));
}

export function resetAppConfig() {
  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
}
