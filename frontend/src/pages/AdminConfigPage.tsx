import { ArrowDown, ArrowUp, ChevronLeft, Download, Link, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { storeAdminUser, validateAdminLogin } from "../services/adminAuthService";
import { resetAppConfig, saveAppConfig } from "../services/configService";
import { clearOperatorId } from "../services/operatorService";
import { endOperatorSession } from "../services/sessionLogService";
import type { AppConfig, FieldType, PartConfig } from "../types/config";

export function AdminConfigPage() {
  const { config, setConfig, adminUser, setAdminUser, setOperatorId } = useAppContext();
  const [adminName, setAdminName] = useState("");
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(Boolean(adminUser));
  const [draftConfig, setDraftConfig] = useState(config);
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [adminMaterialId, setAdminMaterialId] = useState(config.materials[0]?.id ?? "");
  const [adminPartId, setAdminPartId] = useState(config.materials[0]?.parts[0]?.id ?? "");
  const [adminOperationId, setAdminOperationId] = useState(config.materials[0]?.parts[0]?.operations[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const adminMaterial = draftConfig.materials.find((material) => material.id === adminMaterialId);
  const adminPart = adminMaterial?.parts.find((part) => part.id === adminPartId);
  const adminOperation = adminPart?.operations.find((operation) => operation.id === adminOperationId);

  function unlock(event: FormEvent) {
    event.preventDefault();
    if (!validateAdminLogin(adminName, password, config.adminCredentials) && password !== config.adminPassword) {
      setError("Incorrect admin username or password.");
      return;
    }
    const nextAdminUser = adminName || config.adminCredentials?.username || "Mahesh.CH";
    endOperatorSession();
    clearOperatorId();
    storeAdminUser(nextAdminUser);
    setOperatorId("");
    setAdminUser(nextAdminUser);
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
    setMessage("Unsaved admin changes. Press Save to keep them on this iPad.");
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

  function addPart() {
    if (!adminMaterial) {
      return;
    }
    const name = window.prompt("Part page name");
    if (!name) {
      return;
    }
    const serialExample = window.prompt("Serial examples shown to users", "1234567, G123456, or T123456") ?? "";
    const serialPatternText =
      window.prompt("Serial regex rules separated by commas", "^[0-9]{7}$,^G[0-9]{6}$,^T[0-9]{6}$") ?? "";
    const id = `${adminMaterial.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const part: PartConfig = {
      id,
      name,
      serialExample,
      serialPatterns: serialPatternText.split(",").map((item) => item.trim()).filter(Boolean),
      operations: []
    };
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id === adminMaterialId ? { ...material, parts: [...material.parts, part] } : material
      )
    });
    setAdminPartId(id);
    setAdminOperationId("");
  }

  function addMaterial() {
    const name = window.prompt("Material page name");
    if (!name) {
      return;
    }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    updateDraft({
      ...draftConfig,
      materials: [...draftConfig.materials, { id, name, parts: [] }]
    });
    setAdminMaterialId(id);
    setAdminPartId("");
    setAdminOperationId("");
  }

  function editSelectedMaterial() {
    if (!adminMaterial) {
      return;
    }
    const name = window.prompt("Material name", adminMaterial.name);
    if (!name) {
      return;
    }
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) => (material.id === adminMaterialId ? { ...material, name } : material))
    });
  }

  function editSelectedPart() {
    if (!adminPart) {
      return;
    }
    const name = window.prompt("Part page name", adminPart.name);
    if (!name) {
      return;
    }
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : {
              ...material,
              parts: material.parts.map((part) => (part.id === adminPartId ? { ...part, name } : part))
            }
      )
    });
  }

  function moveSelectedMaterial(direction: -1 | 1) {
    const nextMaterials = moveItem(draftConfig.materials, adminMaterialId, direction);
    updateDraft({ ...draftConfig, materials: nextMaterials });
  }

  function moveSelectedPart(direction: -1 | 1) {
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId ? material : { ...material, parts: moveItem(material.parts, adminPartId, direction) }
      )
    });
  }

  function moveSelectedOperation(direction: -1 | 1) {
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : {
              ...material,
              parts: material.parts.map((part) =>
                part.id !== adminPartId ? part : { ...part, operations: moveItem(part.operations, adminOperationId, direction) }
              )
            }
      )
    });
  }

  function editPartSerialRules() {
    if (!adminPart) {
      return;
    }
    const serialExample = window.prompt("Serial examples shown to users", adminPart.serialExample ?? "") ?? adminPart.serialExample ?? "";
    const serialPatternText =
      window.prompt("Serial regex rules separated by commas", adminPart.serialPatterns?.join(",") ?? "") ?? adminPart.serialPatterns?.join(",") ?? "";
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : {
              ...material,
              parts: material.parts.map((part) =>
                part.id === adminPartId
                  ? {
                      ...part,
                      serialExample,
                      serialPatterns: serialPatternText.split(",").map((item) => item.trim()).filter(Boolean)
                    }
                  : part
              )
            }
      )
    });
  }

  function updateSelectedOperation(updater: (name: string) => string | null) {
    if (!adminOperation) {
      return;
    }
    const nextName = updater(adminOperation.name);
    if (!nextName) {
      return;
    }
    updateDraft({
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
                        operation.id === adminOperationId ? { ...operation, name: nextName } : operation
                      )
                    }
              )
            }
      )
    });
  }

  function deleteSelectedOperation() {
    if (!adminOperation || !window.confirm(`Remove ${adminOperation.name}?`)) {
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
                  : { ...part, operations: part.operations.filter((operation) => operation.id !== adminOperationId) }
              )
            }
      )
    };
    const nextPart = nextConfig.materials.find((material) => material.id === adminMaterialId)?.parts.find((part) => part.id === adminPartId);
    setAdminOperationId(nextPart?.operations[0]?.id ?? "");
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
    const type: FieldType = typeAnswer === "select" || typeAnswer === "textarea" ? typeAnswer : "text";
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

  function editFieldDefinition(fieldId: string) {
    const field = draftConfig.fields[fieldId];
    if (!field) {
      return;
    }
    const label = window.prompt("Field label", field.label);
    if (!label) {
      return;
    }
    const typeAnswer = window.prompt("Field type: text, textarea, or select", field.type)?.toLowerCase();
    const type: FieldType = typeAnswer === "select" || typeAnswer === "textarea" ? typeAnswer : "text";
    const required = window.confirm("Should this field be required?");
    const options =
      type === "select"
        ? window
            .prompt("Dropdown options separated by commas", field.options?.join(", ") ?? "")
            ?.split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        : undefined;
    updateDraft({
      ...draftConfig,
      fields: {
        ...draftConfig.fields,
        [fieldId]: { label, type, required, options }
      }
    });
  }

  function deleteFieldDefinition(fieldId: string) {
    if (!window.confirm(`Delete field ${draftConfig.fields[fieldId]?.label ?? fieldId}?`)) {
      return;
    }
    const nextFields = { ...draftConfig.fields };
    delete nextFields[fieldId];
    updateDraft({
      ...draftConfig,
      fields: nextFields,
      materials: draftConfig.materials.map((material) => ({
        ...material,
        parts: material.parts.map((part) => ({
          ...part,
          operations: part.operations.map((operation) => ({
            ...operation,
            requiredFields: operation.requiredFields.filter((item) => item !== fieldId)
          }))
        }))
      }))
    });
  }

  if (!unlocked) {
    return (
      <main className="page narrow-page">
        <section className="login-panel">
          <h1>Admin Config</h1>
          <form className="stack" onSubmit={unlock}>
            <label className="field">
              <span>Admin username</span>
              <input value={adminName} onChange={(event) => setAdminName(event.target.value)} autoComplete="username" />
            </label>
            <label className="field">
              <span>Admin password</span>
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
      <button className="back-button" onClick={() => navigate(-1)}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>Admin Config</h1>
        <p>Build routes and operation fields, then export the config for the deployed app.</p>
      </div>
      <div className="admin-save-bar">
        <strong>Admin changes are local until saved.</strong>
        <div className="button-row">
          <button className="primary-button" onClick={saveConfig}>
            <Save size={22} />
            Save changes
          </button>
          <button className="secondary-button" onClick={downloadConfig}>
            <Download size={22} />
            Export JSON
          </button>
          <button className="secondary-button" onClick={() => navigate("/admin/connections")}>
            <Link size={22} />
            Connections
          </button>
        </div>
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
          <button className="secondary-button" onClick={addPart}>
            <Plus size={22} />
            Add part
          </button>
          <button className="secondary-button" onClick={addMaterial}>
            <Plus size={22} />
            Add material
          </button>
        </div>

        <div className="page-edit-actions">
          <button className="secondary-button" onClick={editSelectedMaterial}>
            <Pencil size={22} />
            Rename material page
          </button>
          <button className="secondary-button" onClick={() => moveSelectedMaterial(-1)}>
            <ArrowUp size={22} />
            Material up
          </button>
          <button className="secondary-button" onClick={() => moveSelectedMaterial(1)}>
            <ArrowDown size={22} />
            Material down
          </button>
          <button className="secondary-button" onClick={editSelectedPart}>
            <Pencil size={22} />
            Rename part page
          </button>
          <button className="secondary-button" onClick={editPartSerialRules}>
            <Pencil size={22} />
            Serial rules
          </button>
          <button className="secondary-button" onClick={() => moveSelectedPart(-1)}>
            <ArrowUp size={22} />
            Part up
          </button>
          <button className="secondary-button" onClick={() => moveSelectedPart(1)}>
            <ArrowDown size={22} />
            Part down
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
            <button className="secondary-button" onClick={() => updateSelectedOperation((name) => window.prompt("Operation name", name))}>
              <Pencil size={22} />
              Edit operation
            </button>
            <button className="secondary-button" onClick={() => moveSelectedOperation(-1)}>
              <ArrowUp size={22} />
              Operation up
            </button>
            <button className="secondary-button" onClick={() => moveSelectedOperation(1)}>
              <ArrowDown size={22} />
              Operation down
            </button>
            <button className="secondary-button danger-button" onClick={deleteSelectedOperation}>
              <Trash2 size={22} />
              Delete operation
            </button>
          </div>
        )}

        <div className="field-builder">
          <div className="field-library">
            <h2>Field Library</h2>
            {Object.entries(draftConfig.fields).map(([fieldId, field]) => (
              <span className="field-chip" draggable key={fieldId} onDragStart={(event) => event.dataTransfer.setData("text/plain", fieldId)}>
                <button onClick={() => addFieldToOperation(fieldId)}>{field.label}</button>
                <button onClick={() => editFieldDefinition(fieldId)} aria-label={`Edit ${field.label}`}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => deleteFieldDefinition(fieldId)} aria-label={`Delete ${field.label}`}>
                  <Trash2 size={15} />
                </button>
              </span>
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
  config.materials.forEach((material) => {
    material.parts.forEach((part) => {
      part.serialPatterns?.forEach((pattern) => {
        new RegExp(pattern);
      });
    });
  });
}

function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (index === -1 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(nextIndex, 0, item);
  return nextItems;
}
