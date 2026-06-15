/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OCR_API_URL?: string;
  readonly VITE_POWER_AUTOMATE_URL?: string;
  readonly VITE_EMPLOYEE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
