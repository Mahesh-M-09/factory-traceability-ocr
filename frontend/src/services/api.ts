import type { OcrResult, OperationRecord } from "../types/config";
import { getOcrApiUrl, getSaveApiUrl } from "./connectionService";
import { blobToBase64 } from "./image";

export async function requestOcr(imageBlob: Blob): Promise<OcrResult> {
  const apiUrl = getOcrApiUrl();
  if (!apiUrl) {
    throw new Error("OCR API URL is not configured.");
  }

  const imageBase64 = await blobToBase64(imageBlob);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: imageBlob.type || "image/jpeg",
      imageBase64
    })
  });

  const result = (await response.json()) as OcrResult;
  if (!response.ok || !result.success) {
    throw new Error(result.error ?? "OCR failed. Please retake image or enter serial manually.");
  }

  return result;
}

export async function saveOperation(record: OperationRecord) {
  const flowUrl = getSaveApiUrl();
  if (!flowUrl) {
    throw new Error("Power Automate URL is not configured.");
  }

  const payload = {
    operatorId: record.operatorId,
    material: record.material,
    part: record.part,
    operation: record.operation,
    serialNumber: record.serialNumber,
    batchNumber: record.formValues.batchNumber ?? "",
    jigUsed: record.formValues.jigUsed ?? "",
    robotUsed: record.formValues.robotUsed ?? "",
    paintStatus: record.formValues.paintStatus ?? "",
    dateTime: record.dateTime,
    notes: record.formValues.notes ?? "",
    fields: record.formValues
  };

  const response = await fetch(flowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
  if (!response.ok || result.success === false) {
    throw new Error(result.message ?? "SharePoint save failed. Please try again.");
  }

  return result;
}
