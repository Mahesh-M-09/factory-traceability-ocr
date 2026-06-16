import type { AppConfig } from "../types/config";

const CONFIG_STORAGE_KEY = "factoryTraceabilityConfig";

export async function loadAppConfig(): Promise<AppConfig> {
  const saved = window.localStorage.getItem(CONFIG_STORAGE_KEY);
  if (saved) {
    const savedConfig = JSON.parse(saved) as AppConfig;
    if (Array.isArray(savedConfig.materials)) {
      return ensureDefaultReworkOperations(savedConfig);
    }
    window.localStorage.removeItem(CONFIG_STORAGE_KEY);
  }

  const response = await fetch("config/app-config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load app configuration.");
  }

  return ensureDefaultReworkOperations((await response.json()) as AppConfig);
}

export function saveAppConfig(config: AppConfig) {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config, null, 2));
}

export function resetAppConfig() {
  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
}

function ensureDefaultReworkOperations(config: AppConfig): AppConfig {
  const fields = {
    ...config.fields,
    reworkStatus: config.fields.reworkStatus ?? {
      label: "Final rework",
      type: "select" as const,
      required: true,
      options: ["No Rework", "Rework Required", "Reworked OK", "Scrap"]
    }
  };

  return {
    ...config,
    fields,
    materials: config.materials.map((material) => ({
      ...material,
      parts: material.parts.map((part) => {
        const hasRework = part.operations.some((operation) => operation.name.toLowerCase().includes("rework"));
        if (hasRework) {
          return part;
        }
        return {
          ...part,
          operations: [
            ...part.operations,
            {
              id: `${part.id}-final-rework`,
              name: "Final Rework",
              captureMode: "ocr" as const,
              requiredFields: ["reworkStatus", "notes"]
            }
          ]
        };
      })
    }))
  };
}
