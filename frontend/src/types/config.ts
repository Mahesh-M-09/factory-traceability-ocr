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
  captureMode?: "ocr" | "none";
  requiredFields: string[];
}

export interface PartConfig {
  id: string;
  name: string;
  serialPatterns?: string[];
  serialExample?: string;
  operations: OperationConfig[];
}

export interface MaterialConfig {
  id: string;
  name: string;
  parts: PartConfig[];
}

export interface AppConfig {
  adminPassword: string;
  adminCredentials?: {
    username: string;
    password: string;
  };
  autoCaptureEnabled: boolean;
  ocrConfidenceThreshold: number;
  employees: string[];
  allowedCharacters: string;
  frameTypes: FrameTypeConfig[];
  materials: MaterialConfig[];
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
  imageBlob: Blob | null;
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
  id?: string;
  operatorId: string;
  material: string;
  part: string;
  tableName?: string;
  operation: string;
  serialNumber: string;
  linkedHingeSerial?: string;
  cycleTimeSeconds?: number;
  dateTime: string;
  ocrConfidence: number;
  manualCorrection: boolean;
  imageBase64: string;
  formValues: Record<string, string>;
}

export interface DemoTraceRecord {
  serialNumber: string;
  material: string;
  part: string;
  tableName: string;
  batchNumber: string;
  status: string;
  requiresInvestigation: boolean;
  linkedHingeSerial: string;
  createdAt: string;
  updatedAt: string;
  columns: Record<string, string>;
  reworkLog: string[];
  events: OperationRecord[];
}

export interface OperatorSessionLog {
  id: string;
  operatorId: string;
  signedInAt: string;
  signedOutAt: string;
}

export interface OperationVisitLog {
  id: string;
  operatorId: string;
  material: string;
  part: string;
  operation: string;
  enteredAt: string;
  exitedAt: string;
  seconds: number;
}
