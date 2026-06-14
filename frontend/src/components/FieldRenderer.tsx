import type React from "react";
import type { FieldConfig } from "../types/config";

interface FieldRendererProps {
  id: string;
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function FieldRenderer({ id, field, value, onChange }: FieldRendererProps) {
  const commonProps = {
    id,
    name: id,
    value,
    required: field.required,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(event.target.value)
  };

  return (
    <label className="field">
      <span>
        {field.label}
        {field.required && <strong> *</strong>}
      </span>
      {field.type === "textarea" && <textarea {...commonProps} rows={4} />}
      {field.type === "select" && (
        <select {...commonProps}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      {field.type === "text" && <input {...commonProps} type="text" autoComplete="off" />}
    </label>
  );
}
