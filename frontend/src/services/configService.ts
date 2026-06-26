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
    robotNumber: withFieldDefaults(config.fields.robotNumber, {
      label: "Robot number",
      type: "select" as const,
      required: true,
      options: ["01"],
      defaultValue: "01"
    }),
    jigUsed: withFieldDefaults(config.fields.jigUsed, {
      label: "Jig used",
      type: "select" as const,
      required: true,
      options: ["JIG 01", "JIG 02"],
      defaultValue: "JIG 01"
    }),
    jigCapture: config.fields.jigCapture ?? { label: "Jig scan / entered", type: "text" as const, required: false },
    hingeSerial: config.fields.hingeSerial ?? { label: "MF-Hinge ID", type: "text" as const, required: true },
    passFail: config.fields.passFail ?? {
      label: "Pass / fail",
      type: "select" as const,
      required: true,
      options: ["Pass", "Fail"]
    },
    sendToRework: withFieldDefaults(config.fields.sendToRework, {
      label: "Send to rework",
      type: "select" as const,
      required: false,
      options: ["No", "Yes"],
      defaultValue: "No"
    }),
    reworkReason: withFieldDefaults(config.fields.reworkReason, {
      label: "Rework reason",
      type: "select" as const,
      required: false,
      options: ["Other"],
      defaultValue: "",
      visibleWhen: { fieldId: "sendToRework", equals: "Yes" }
    }),
    scrapStatus: {
      ...(config.fields.scrapStatus ?? {}),
      label: "Part status",
      type: "select" as const,
      required: false,
      options: ["Active", "Rework", "Hold", "Scrap"],
      defaultValue: config.fields.scrapStatus?.defaultValue ?? "Active"
    },
    reworkAction: withFieldDefaults(config.fields.reworkAction, {
      label: "Rework action",
      type: "select" as const,
      required: true,
      options: ["Return to active", "Keep in rework", "Scrap"],
      defaultValue: "Return to active"
    }),
    reworkEntry: config.fields.reworkEntry ?? {
      label: "Rework notes",
      type: "textarea" as const,
      required: false,
      visibleWhen: { fieldId: "sendToRework", equals: "Yes" }
    }
  };

  const materials = config.materials.map((material) => ({
      ...material,
      parts: ensureTraceabilityParts(material.id, material.parts).map((part) => {
        const partWithSerialRules = ensureSerialRules(part);
        return ensureTraceabilityOperations({
          ...partWithSerialRules,
          operations: partWithSerialRules.operations.filter((operation) => operation.name.toLowerCase() !== "final rework")
        });
      })
    }));

  return {
    ...config,
    adminCredentials: config.adminCredentials ?? { username: "Mahesh.CH", password: "Brompton1234" },
    users: ensureDefaultUsers({ ...config, materials }),
    fields,
    materials
  };
}

function withFieldDefaults<T extends { defaultValue?: string; options?: string[]; visibleWhen?: { fieldId: string; equals: string } }>(field: T | undefined, defaults: T): T {
  return {
    ...defaults,
    ...(field ?? {}),
    defaultValue: field?.defaultValue ?? defaults.defaultValue,
    options: field?.options?.length ? field.options : defaults.options,
    visibleWhen: field?.visibleWhen ?? defaults.visibleWhen
  };
}

function ensureDefaultUsers(config: AppConfig) {
  if (config.users?.length) {
    return config.users;
  }

  const allAccess = config.materials.flatMap((material) =>
    material.parts.map((part) => ({
      materialId: material.id,
      partId: part.id,
      operationIds: part.operations.map((operation) => operation.id)
    }))
  );

  return [
    {
      id: "1201",
      name: "Mahesh",
      role: "operator" as const,
      access: allAccess
    },
    {
      id: "9001",
      name: "Team Lead",
      role: "teamLead" as const,
      access: allAccess
    }
  ];
}

function ensureSerialRules(part: PartConfig): PartConfig {
  if (part.name.toLowerCase() === "mainframe") {
    return {
      ...part,
      serialPatterns: part.serialPatterns?.length ? part.serialPatterns : ["^[0-9]{7}$", "^G[0-9]{6}$", "^T[0-9]{6}$"],
      serialExample: part.serialExample ?? "1234567, G123456, or T123456",
      mistakeReasons: part.mistakeReasons?.length
        ? part.mistakeReasons
        : ["Braze gap", "Jig alignment", "Stamp unclear", "Surface damage", "Wrong hinge link", "Other"]
    };
  }

  return {
    ...part,
    serialPatterns: part.serialPatterns?.length ? part.serialPatterns : ["^[A-Z0-9]{3,12}$"],
    serialExample: part.serialExample ?? "3 to 12 letters/numbers",
    mistakeReasons: part.mistakeReasons?.length ? part.mistakeReasons : ["Stamp unclear", "Damage", "Wrong fit", "Other"]
  };
}

function ensureTraceabilityParts(materialId: string, parts: PartConfig[]) {
  if (materialId !== "steel" && materialId !== "titanium") {
    return parts;
  }

  const nextParts = [...parts];
  const hingePartId = `${materialId}-hinge`;
  if (!nextParts.some((part) => part.id === hingePartId || part.name.toLowerCase() === "hinge")) {
    nextParts.push({
      id: hingePartId,
      name: "Hinge",
      operations: []
    });
  }

  const reworkPartId = `${materialId}-rework`;
  if (!nextParts.some((part) => part.id === reworkPartId || part.name.toLowerCase() === "rework")) {
    nextParts.push({
      id: reworkPartId,
      name: "Rework",
      serialPatterns: ["^[A-Z0-9-]{3,16}$"],
      serialExample: "Any recognised part serial",
      mistakeReasons: ["Braze defect", "Jig damage", "Stamp unclear", "Alignment issue", "Other"],
      operations: []
    });
  }

  return nextParts;
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
        requiredFields: ["robotNumber", "jigUsed", "sendToRework", "reworkReason", "reworkEntry", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-manual-braze`,
        name: "MFFBBA Manual Braze",
        captureMode: "ocr",
        requiredFields: ["jigUsed", "jigCapture", "sendToRework", "reworkReason", "reworkEntry", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-assembly-link`,
        name: "Mainframe + MFFBBA Assembly",
        captureMode: "ocr",
        requiredFields: ["hingeSerial", "jigUsed", "sendToRework", "reworkReason", "reworkEntry", "scrapStatus", "notes"]
      },
      {
        id: `${part.id}-akea`,
        name: "AKEA",
        captureMode: "ocr",
        requiredFields: ["passFail", "sendToRework", "reworkReason", "scrapStatus", "reworkEntry", "notes"]
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
        requiredFields: ["jigUsed", "jigCapture", "sendToRework", "reworkReason", "reworkEntry", "scrapStatus", "notes"]
      }
    ]);
  }

  if (name === "rework") {
    return ensureOperations(part, [
      {
        id: `${part.id}-bench`,
        name: "Rework Bench",
        captureMode: "ocr",
        afterSubmit: "sameOperation",
        requiredFields: ["reworkAction", "reworkReason", "reworkEntry", "scrapStatus", "notes"]
      }
    ]);
  }

  return {
    ...part,
    operations: part.operations.map((operation) => ({
      ...operation,
      afterSubmit: operation.afterSubmit ?? "sameOperation"
    }))
  };
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
              afterSubmit: operation.afterSubmit ?? requiredOperation.afterSubmit ?? "sameOperation",
              requiredFields: Array.from(new Set([...operation.requiredFields, ...requiredOperation.requiredFields]))
            }
          : operation
      );
    }, part.operations).map((operation) => ({ ...operation, afterSubmit: operation.afterSubmit ?? "sameOperation" }))
  };
}
