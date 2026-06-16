import type { OcrResult, OperationRecord } from "../types/config";

export async function requestOcr(imageBlob: Blob): Promise<OcrResult> {
  const apiUrl = import.meta.env.VITE_OCR_API_URL as string | undefined;
  if (!apiUrl) {
    throw new Error("OCR API URL is not configured.");
  }

  const formData = new FormData();
  formData.append("image", imageBlob, "frame.jpg");

  const response = await fetch(apiUrl, {
    method: "POST",
    body: formData
  });

  const result = (await response.json()) as OcrResult;
  if (!response.ok || !result.success) {
    throw new Error(result.error ?? "OCR failed. Please retake image or enter serial manually.");
  }

  return result;
}

export async function saveOperation(record: OperationRecord) {
  const flowUrl = import.meta.env.VITE_POWER_AUTOMATE_URL as string | undefined;
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
    ocrConfidence: record.ocrConfidence,
    manualCorrection: record.manualCorrection,
    notes: record.formValues.notes ?? "",
    imageBase64: record.imageBase64,
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
