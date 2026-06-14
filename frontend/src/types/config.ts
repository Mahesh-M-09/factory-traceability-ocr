export type FieldType = "text" | "textarea" | "select";

export interface FieldConfig {
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

export interface FrameTypeConfig {
  id: string;
  name: string;
  serialPattern: string;
  example: string;
}

export interface OperationConfig {
  id: string;
  name: string;
  requiredFields: string[];
}

export interface AppConfig {
  adminPassword: string;
  autoCaptureEnabled: boolean;
  ocrConfidenceThreshold: number;
  employees: string[];
  allowedCharacters: string;
  frameTypes: FrameTypeConfig[];
  operations: OperationConfig[];
  fields: Record<string, FieldConfig>;
}

export interface OcrResult {
  success: boolean;
  serialNumber?: string;
  confidence?: number;
  rawText?: string[];
  needsReview?: boolean;
  error?: string;
}

export interface CaptureState {
  imageBlob: Blob;
  imageBase64: string;
  previewUrl: string;
  serialNumber: string;
  originalSerialNumber: string;
  confidence: number;
  rawText: string[];
  needsReview: boolean;
  frameTypeId: string;
}

export interface OperationRecord {
  operatorId: string;
  operation: string;
  serialNumber: string;
  dateTime: string;
  ocrConfidence: number;
  manualCorrection: boolean;
  imageBase64: string;
  formValues: Record<string, string>;
}
