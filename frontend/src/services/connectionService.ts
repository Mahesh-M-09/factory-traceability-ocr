export interface ConnectionSettings {
  ocrApiUrl: string;
  saveApiUrl: string;
  readApiUrl: string;
  saveMode: "powerAutomate" | "googleSheet";
}

const CONNECTION_STORAGE_KEY = "factoryTraceabilityConnections";
const DEFAULT_OCR_API_URL =
  "https://brompton-trace-ocr-api-09-ctanc7bwgng8gya0.uksouth-01.azurewebsites.net/api/ocr?code=Qa-xNg2cz6vW_4tq1MUPPM0sqnFpauQw6ROKn5pHH0Z3AzFu_A-eOg==";

export function loadConnectionSettings(): ConnectionSettings {
  const saved = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
  if (!saved) {
    return getDefaultConnectionSettings();
  }
  try {
    const settings = { ...getDefaultConnectionSettings(), ...(JSON.parse(saved) as Partial<ConnectionSettings>) };
    return { ...settings, ocrApiUrl: settings.ocrApiUrl || DEFAULT_OCR_API_URL };
  } catch {
    window.localStorage.removeItem(CONNECTION_STORAGE_KEY);
    return getDefaultConnectionSettings();
  }
}

export function saveConnectionSettings(settings: ConnectionSettings) {
  window.localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(settings, null, 2));
}

export function getOcrApiUrl() {
  return loadConnectionSettings().ocrApiUrl || DEFAULT_OCR_API_URL || (import.meta.env.VITE_OCR_API_URL as string | undefined) || "";
}

export function getSaveApiUrl() {
  return loadConnectionSettings().saveApiUrl || (import.meta.env.VITE_POWER_AUTOMATE_URL as string | undefined) || "";
}

function getDefaultConnectionSettings(): ConnectionSettings {
  return {
    ocrApiUrl: DEFAULT_OCR_API_URL,
    saveApiUrl: "",
    readApiUrl: "",
    saveMode: "powerAutomate"
  };
}
