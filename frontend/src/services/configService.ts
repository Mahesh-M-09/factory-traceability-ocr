import type { AppConfig, OperationConfig, PartConfig } from "../types/config";

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
    batchNumber: config.fields.batchNumber ?? { label: "Batch number", type: "text" as const, required: true },
    startSerial: config.fields.startSerial ?? { label: "First stamped serial", type: "text" as const, required: true },
    endSerial: config.fields.endSerial ?? { label: "Last stamped serial", type: "text" as const, required: true },
    robotNumber: config.fields.robotNumber ?? { label: "Robot number", type: "text" as const, required: true },
    jigUsed: config.fields.jigUsed ?? {
      label: "Jig used",
      type: "select" as const,
      required: true,
      options: ["JIG 01", "JIG 02"]
    },
    jigCapture: config.fields.jigCapture ?? { label: "Jig scan / entered", type: "text" as const, required: false },
    hingeSerial: config.fields.hingeSerial ?? { label: "MF-Hinge ID", type: "text" as const, required: true },
    passFail: config.fields.passFail ?? {
      label: "Pass / fail",
      type: "select" as const,
      required: true,
      options: ["Pass", "Fail"]
    },
    scrapStatus: config.fields.scrapStatus ?? {
      label: "Scrap status",
      type: "select" as const,
      required: false,
      options: ["Active", "Scrap"]
    },
    reworkEntry: config.fields.reworkEntry ?? {
      label: "Rework entry",
      type: "textarea" as const,
      required: false
    },
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
      parts: ensureTraceabilityParts(material.id, material.parts).map((part) => {
        const hasRework = part.operations.some((operation) => operation.name.toLowerCase().includes("rework"));
        if (hasRework) {
          return ensureTraceabilityOperations(part);
        }
        return ensureTraceabilityOperations({
          ...part,
          operations: [
            ...part.operations,
            {
              id: `${part.id}-final-rework`,
              name: "Final Rework",
              captureMode: "ocr" as const,
              requiredFields: ["reworkStatus", "scrapStatus", "reworkEntry", "notes"]
            }
          ]
        });
      })
    }))
  };
}

function ensureTraceabilityParts(materialId: string, parts: PartConfig[]) {
  if (materialId !== "steel" && materialId !== "titanium") {
    return parts;
  }

  const hingePartId = `${materialId}-hinge`;
  if (parts.some((part) => part.id === hingePartId || part.name.toLowerCase() === "hinge")) {
    return parts;
  }

  return [
    ...parts,
    {
      id: hingePartId,
      name: "Hinge",
      operations: []
    }
  ];
}

function ensureTraceabilityOperations(part: PartConfig) {
  const name = part.name.toLowerCase();
  if (name === "mainframe") {
    return ensureOperations(part, [
      {
        id: `${part.id}-stamping`,
        name: "Stamping",
        captureMode: "none",
        requiredFields: ["batchNumber", "startSerial", "endSerial", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-robot-braze`,
        name: "MFFBBA Robot Braze",
        captureMode: "ocr",
        requiredFields: ["robotNumber", "jigUsed", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-manual-braze`,
        name: "MFFBBA Manual Braze",
        captureMode: "ocr",
        requiredFields: ["jigUsed", "jigCapture", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-assembly-link`,
        name: "Mainframe + MFFBBA Assembly",
        captureMode: "ocr",
        requiredFields: ["hingeSerial", "jigUsed", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-akea`,
        name: "AKEA",
        captureMode: "ocr",
        requiredFields: ["passFail", "scrapStatus", "reworkEntry", "notes"]
      }
    ]);
  }

  if (name === "hinge") {
    return ensureOperations(part, [
      {
        id: `${part.id}-stamping`,
        name: "Hinge Stamping",
        captureMode: "none",
        requiredFields: ["batchNumber", "startSerial", "endSerial", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-braze`,
        name: "Hinge Braze",
        captureMode: "ocr",
        requiredFields: ["jigUsed", "jigCapture", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-final-rework`,
        name: "Final Rework",
        captureMode: "ocr",
        requiredFields: ["reworkStatus", "scrapStatus", "reworkEntry", "notes"]
      }
    ]);
  }

  return ensureOperations(part, [
    {
      id: `${part.id}-final-rework`,
      name: "Final Rework",
      captureMode: "ocr",
      requiredFields: ["reworkStatus", "scrapStatus", "reworkEntry", "notes"]
    }
  ]);
}

function ensureOperations(part: PartConfig, requiredOperations: OperationConfig[]) {
  return {
    ...part,
    operations: requiredOperations.reduce((operations, requiredOperation) => {
      const existingIndex = operations.findIndex(
        (operation) => operation.id === requiredOperation.id || operation.name.toLowerCase() === requiredOperation.name.toLowerCase()
      );
      if (existingIndex === -1) {
        return [...operations, requiredOperation];
      }
      return operations.map((operation, index) =>
        index === existingIndex
          ? {
              ...operation,
              name: requiredOperation.name,
              captureMode: requiredOperation.captureMode,
              requiredFields: Array.from(new Set([...operation.requiredFields, ...requiredOperation.requiredFields]))
            }
          : operation
      );
    }, part.operations)
  };
}
