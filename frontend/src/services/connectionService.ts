export interface ConnectionSettings {
  ocrApiUrl: string;
  saveApiUrl: string;
  readApiUrl: string;
  saveMode: "powerAutomate" | "googleSheet";
}

const CONNECTION_STORAGE_KEY = "factoryTraceabilityConnections";

export function loadConnectionSettings(): ConnectionSettings {
  const saved = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
  if (!saved) {
    return getDefaultConnectionSettings();
  }
  try {
    return { ...getDefaultConnectionSettings(), ...(JSON.parse(saved) as Partial<ConnectionSettings>) };
  } catch {
    window.localStorage.removeItem(CONNECTION_STORAGE_KEY);
    return getDefaultConnectionSettings();
  }
}

export function saveConnectionSettings(settings: ConnectionSettings) {
  window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(settings, null, 2));
}

export function getOcrApiUrl() {
  return loadConnectionSettings().ocrApiUrl || (import.meta.env.VITE_OCR_API_URL as string | undefined) || "";
}

export function getSaveApiUrl() {
  return loadConnectionSettings().saveApiUrl || (import.meta.env.VITE_POWER_AUTOMATE_URL as string | undefined) || "";
}

function getDefaultConnectionSettings(): ConnectionSettings {
  return {
    ocrApiUrl: "",
    saveApiUrl: "",
    readApiUrl: "",
    saveMode: "powerAutomate"
  };
}
