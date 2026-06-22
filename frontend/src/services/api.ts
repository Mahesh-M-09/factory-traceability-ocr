import type { OcrResult, OperationRecord } from "../types/config";
import { getOcrApiUrl } from "./connectionService";
import { saveDemoOperation } from "./demoDatabaseService";
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
  return saveDemoOperation(record);
}
