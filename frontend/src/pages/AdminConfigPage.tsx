import { Download, Plus, RotateCcw, Save, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAppContext } from "../App";
import { resetAppConfig, saveAppConfig } from "../services/configService";
import type { AppConfig } from "../types/config";

export function AdminConfigPage() {
  const { config, setConfig } = useAppContext();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [draftConfig, setDraftConfig] = useState(config);
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [adminMaterialId, setAdminMaterialId] = useState(config.materials[0]?.id ?? "");
  const [adminPartId, setAdminPartId] = useState(config.materials[0]?.parts[0]?.id ?? "");
  const [adminOperationId, setAdminOperationId] = useState(config.materials[0]?.parts[0]?.operations[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const adminMaterial = draftConfig.materials.find((material) => material.id === adminMaterialId);
  const adminPart = adminMaterial?.parts.find((part) => part.id === adminPartId);
  const adminOperation = adminPart?.operations.find((operation) => operation.id === adminOperationId);

  function unlock(event: FormEvent) {
    event.preventDefault();
    if (password !== config.adminPassword) {
      setError("Incorrect admin password.");
      return;
    }
    setUnlocked(true);
    setError("");
  }

  function saveConfig() {
    setError("");
    setMessage("");
    try {
      const parsed = JSON.parse(jsonText) as AppConfig;
      validateConfig(parsed);
      saveAppConfig(parsed);
      setDraftConfig(parsed);
      setConfig(parsed);
      setMessage("Config saved in this browser. Export JSON to update the hosted file.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Config is not valid JSON.");
    }
  }

  function downloadConfig() {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "app-config.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function updateDraft(nextConfig: AppConfig) {
    setDraftConfig(nextConfig);
    setJsonText(JSON.stringify(nextConfig, null, 2));
  }

  function addFieldToOperation(fieldId: string) {
    if (!adminOperation || adminOperation.requiredFields.includes(fieldId)) {
      return;
    }

    const nextConfig = {
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : {
              ...material,
              parts: material.parts.map((part) =>
                part.id !== adminPartId
                  ? part
                  : {
                      ...part,
                      operations: part.operations.map((operation) =>
                        operation.id !== adminOperationId
                          ? operation
                          : { ...operation, requiredFields: [...operation.requiredFields, fieldId] }
                      )
                    }
              )
            }
      )
    };
    updateDraft(nextConfig);
  }

  function removeFieldFromOperation(fieldId: string) {
    const nextConfig = {
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : {
              ...material,
              parts: material.parts.map((part) =>
                part.id !== adminPartId
                  ? part
                  : {
                      ...part,
                      operations: part.operations.map((operation) =>
                        operation.id !== adminOperationId
                          ? operation
                          : { ...operation, requiredFields: operation.requiredFields.filter((item) => item !== fieldId) }
                      )
                    }
              )
            }
      )
    };
    updateDraft(nextConfig);
  }

  function addOperation() {
    if (!adminPart) {
      return;
    }
    const name = window.prompt("Operation name");
    if (!name) {
      return;
    }
    const id = `${adminPart.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const nextConfig = {
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : {
              ...material,
              parts: material.parts.map((part) =>
                part.id !== adminPartId
                  ? part
                  : { ...part, operations: [...part.operations, { id, name, captureMode: "none" as const, requiredFields: [] }] }
              )
            }
      )
    };
    setAdminOperationId(id);
    updateDraft(nextConfig);
  }

  function updateOperationCaptureMode(captureMode: "ocr" | "none") {
    const nextConfig = {
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : {
              ...material,
              parts: material.parts.map((part) =>
                part.id !== adminPartId
                  ? part
                  : {
                      ...part,
                      operations: part.operations.map((operation) =>
                        operation.id !== adminOperationId ? operation : { ...operation, captureMode }
                      )
                    }
              )
            }
      )
    };
    updateDraft(nextConfig);
  }

  function addFieldDefinition() {
    const label = window.prompt("Field label, for example Jig used");
    if (!label) {
      return;
    }
    const typeAnswer = window.prompt("Field type: text, textarea, or select", "text")?.toLowerCase();
    const type = typeAnswer === "select" || typeAnswer === "textarea" ? typeAnswer : "text";
    const required = window.confirm("Should this field be required?");
    const options =
      type === "select"
        ? window
            .prompt("Dropdown options separated by commas", "Option 1, Option 2")
            ?.split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        : undefined;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    updateDraft({
      ...draftConfig,
      fields: {
        ...draftConfig.fields,
        [id]: { label, type, required, options }
      }
    });
  }

  if (!unlocked) {
    return (
      <main className="page narrow-page">
        <section className="login-panel">
          <h1>Admin Config</h1>
          <form className="stack" onSubmit={unlock}>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error && <div className="error-message">{error}</div>}
            <button className="primary-button">Unlock</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page admin-page">
      <div className="page-heading">
        <h1>Admin Config</h1>
        <p>Build routes and operation fields, then export the config for the deployed app.</p>
      </div>
      <section className="admin-builder">
        <div className="admin-controls">
          <label className="field">
            <span>Material</span>
            <select
              value={adminMaterialId}
              onChange={(event) => {
                const material = draftConfig.materials.find((item) => item.id === event.target.value);
                setAdminMaterialId(event.target.value);
                setAdminPartId(material?.parts[0]?.id ?? "");
                setAdminOperationId(material?.parts[0]?.operations[0]?.id ?? "");
              }}
            >
              {draftConfig.materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Part</span>
            <select
              value={adminPartId}
              onChange={(event) => {
                const part = adminMaterial?.parts.find((item) => item.id === event.target.value);
                setAdminPartId(event.target.value);
                setAdminOperationId(part?.operations[0]?.id ?? "");
              }}
            >
              {adminMaterial?.parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Operation</span>
            <select value={adminOperationId} onChange={(event) => setAdminOperationId(event.target.value)}>
              <option value="">No operation</option>
              {adminPart?.operations.map((operation) => (
                <option key={operation.id} value={operation.id}>
                  {operation.name}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" onClick={addOperation}>
            <Plus size={22} />
            Add operation
          </button>
        </div>

        {adminOperation && (
          <div className="operation-settings">
            <label className="field">
              <span>Camera / OCR</span>
              <select
                value={adminOperation.captureMode ?? "ocr"}
                onChange={(event) => updateOperationCaptureMode(event.target.value === "none" ? "none" : "ocr")}
              >
                <option value="ocr">Required</option>
                <option value="none">Not required</option>
              </select>
            </label>
            <button className="secondary-button" onClick={addFieldDefinition}>
              <Plus size={22} />
              Create field
            </button>
          </div>
        )}

        <div className="field-builder">
          <div className="field-library">
            <h2>Field Library</h2>
            {Object.entries(draftConfig.fields).map(([fieldId, field]) => (
              <button
                className="field-chip"
                draggable
                key={fieldId}
                onClick={() => addFieldToOperation(fieldId)}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", fieldId)}
              >
                {field.label}
              </button>
            ))}
          </div>
          <div
            className="operation-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => addFieldToOperation(event.dataTransfer.getData("text/plain"))}
          >
            <h2>{adminOperation?.name ?? "Select an operation"}</h2>
            <p>Drag fields here or tap a field to add it.</p>
            <div className="assigned-fields">
              {adminOperation?.requiredFields.map((fieldId) => (
                <span className="assigned-field" key={fieldId}>
                  {draftConfig.fields[fieldId]?.label ?? fieldId}
                  <button onClick={() => removeFieldFromOperation(fieldId)} aria-label={`Remove ${fieldId}`}>
                    <X size={16} />
                  </button>
                </span>
              ))}
              {adminOperation && adminOperation.requiredFields.length === 0 && <span className="muted-text">No fields assigned</span>}
            </div>
          </div>
        </div>
      </section>
      <textarea className="json-editor" value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} />
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
      <div className="button-row">
        <button className="primary-button" onClick={saveConfig}>
          <Save size={22} />
          Save
        </button>
        <button className="secondary-button" onClick={downloadConfig}>
          <Download size={22} />
          Export JSON
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            resetAppConfig();
            window.location.reload();
          }}
        >
          <RotateCcw size={22} />
          Reset local
        </button>
      </div>
    </main>
  );
}

function validateConfig(config: AppConfig) {
  if (!Array.isArray(config.materials) || config.materials.length === 0) {
    throw new Error("Config must include at least one material.");
  }
  if (!Array.isArray(config.frameTypes) || config.frameTypes.length === 0) {
    throw new Error("Config must include at least one frame type.");
  }
  config.frameTypes.forEach((frameType) => {
    new RegExp(frameType.serialPattern);
  });
}
