import { ArrowDown, ArrowUp, ChevronLeft, Download, Link, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { storeAdminUser, validateAdminLogin } from "../services/adminAuthService";
import { resetAppConfig, saveAppConfig } from "../services/configService";
import { clearOperatorId } from "../services/operatorService";
import { endOperatorSession } from "../services/sessionLogService";
import type { AppConfig, AppUserConfig, FieldType, OperationConfig, PartConfig } from "../types/config";

type AdminTab = "route" | "serial" | "fields" | "users" | "json";

export function AdminConfigPage() {
  const { config, setConfig, adminUser, setAdminUser, setOperatorId } = useAppContext();
  const [adminName, setAdminName] = useState("");
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(Boolean(adminUser));
  const [draftConfig, setDraftConfig] = useState(config);
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [activeTab, setActiveTab] = useState<AdminTab>("route");
  const [adminMaterialId, setAdminMaterialId] = useState(config.materials[0]?.id ?? "");
  const [adminPartId, setAdminPartId] = useState(config.materials[0]?.parts[0]?.id ?? "");
  const [adminOperationId, setAdminOperationId] = useState(config.materials[0]?.parts[0]?.operations[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const adminMaterial = draftConfig.materials.find((material) => material.id === adminMaterialId);
  const adminPart = adminMaterial?.parts.find((part) => part.id === adminPartId);
  const adminOperation = adminPart?.operations.find((operation) => operation.id === adminOperationId);
  const allAccess = useMemo(
    () =>
      draftConfig.materials.flatMap((material) =>
        material.parts.map((part) => ({
          materialId: material.id,
          partId: part.id,
          operationIds: part.operations.map((operation) => operation.id)
        }))
      ),
    [draftConfig.materials]
  );

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

  function updateDraft(nextConfig: AppConfig) {
    setDraftConfig(nextConfig);
    setJsonText(JSON.stringify(nextConfig, null, 2));
    setMessage("Unsaved admin changes. Press Save changes before leaving.");
    setError("");
  }

  function saveConfig() {
    try {
      const parsed = activeTab === "json" ? (JSON.parse(jsonText) as AppConfig) : draftConfig;
      validateConfig(parsed);
      saveAppConfig(parsed);
      setDraftConfig(parsed);
      setConfig(parsed);
      setJsonText(JSON.stringify(parsed, null, 2));
      setMessage("Config saved in this browser. Export JSON when you want to update the hosted config file.");
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Config is not valid.");
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

  function addMaterial() {
    const name = window.prompt("Material name");
    if (!name) return;
    const id = slugify(name);
    updateDraft({ ...draftConfig, materials: [...draftConfig.materials, { id, name, parts: [] }] });
    setAdminMaterialId(id);
    setAdminPartId("");
    setAdminOperationId("");
  }

  function renameMaterial() {
    if (!adminMaterial) return;
    const name = window.prompt("Material name", adminMaterial.name);
    if (!name) return;
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) => (material.id === adminMaterialId ? { ...material, name } : material))
    });
  }

  function addPart() {
    if (!adminMaterial) return;
    const name = window.prompt("Part name");
    if (!name) return;
    const serialExample = window.prompt("Serial examples for this part", "1234567, G123456, or T123456") ?? "";
    const patterns = promptSerialPatterns();
    const id = `${adminMaterial.id}-${slugify(name)}`;
    const part: PartConfig = { id, name, serialExample, serialPatterns: patterns, operations: [] };
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id === adminMaterialId ? { ...material, parts: [...material.parts, part] } : material
      )
    });
    setAdminPartId(id);
    setAdminOperationId("");
  }

  function renamePart() {
    if (!adminPart) return;
    const name = window.prompt("Part name", adminPart.name);
    if (!name) return;
    updateSelectedPart({ ...adminPart, name });
  }

  function editPartSerialRules() {
    if (!adminPart) return;
    const serialExample = window.prompt("Serial examples shown to users", adminPart.serialExample ?? "") ?? adminPart.serialExample ?? "";
    const serialPatternText =
      window.prompt("Serial regex rules separated by commas", adminPart.serialPatterns?.join(",") ?? "") ??
      adminPart.serialPatterns?.join(",") ??
      "";
    updateSelectedPart({
      ...adminPart,
      serialExample,
      serialPatterns: serialPatternText.split(",").map((item) => item.trim()).filter(Boolean)
    });
  }

  function addOperation() {
    if (!adminPart) return;
    const name = window.prompt("Operation name");
    if (!name) return;
    const id = `${adminPart.id}-${slugify(name)}`;
    updateSelectedPart({
      ...adminPart,
      operations: [...adminPart.operations, { id, name, captureMode: "ocr", requiredFields: ["notes"] }]
    });
    setAdminOperationId(id);
  }

  function updateOperation(nextOperation: OperationConfig) {
    if (!adminPart) return;
    updateSelectedPart({
      ...adminPart,
      operations: adminPart.operations.map((operation) => (operation.id === nextOperation.id ? nextOperation : operation))
    });
  }

  function deleteOperation() {
    if (!adminPart || !adminOperation || !window.confirm(`Remove ${adminOperation.name}?`)) return;
    const operations = adminPart.operations.filter((operation) => operation.id !== adminOperationId);
    updateSelectedPart({ ...adminPart, operations });
    setAdminOperationId(operations[0]?.id ?? "");
  }

  function moveMaterial(direction: -1 | 1) {
    updateDraft({ ...draftConfig, materials: moveItem(draftConfig.materials, adminMaterialId, direction) });
  }

  function movePart(direction: -1 | 1) {
    if (!adminMaterial) return;
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id === adminMaterialId ? { ...material, parts: moveItem(material.parts, adminPartId, direction) } : material
      )
    });
  }

  function moveOperation(direction: -1 | 1) {
    if (!adminPart) return;
    updateSelectedPart({ ...adminPart, operations: moveItem(adminPart.operations, adminOperationId, direction) });
  }

  function addFieldDefinition() {
    const label = window.prompt("Field label, for example Jig used");
    if (!label) return;
    const typeAnswer = window.prompt("Field type: text, textarea, or select", "text")?.toLowerCase();
    const type: FieldType = typeAnswer === "select" || typeAnswer === "textarea" ? typeAnswer : "text";
    const required = window.confirm("Should this field be required?");
    const options =
      type === "select"
        ? window.prompt("Dropdown options separated by commas", "Option 1, Option 2")?.split(",").map((option) => option.trim()).filter(Boolean)
        : undefined;
    updateDraft({
      ...draftConfig,
      fields: { ...draftConfig.fields, [slugify(label)]: { label, type, required, options } }
    });
  }

  function editField(fieldId: string) {
    const field = draftConfig.fields[fieldId];
    if (!field) return;
    const label = window.prompt("Field label", field.label);
    if (!label) return;
    const typeAnswer = window.prompt("Field type: text, textarea, or select", field.type)?.toLowerCase();
    const type: FieldType = typeAnswer === "select" || typeAnswer === "textarea" ? typeAnswer : "text";
    const required = window.confirm("Should this field be required?");
    const options =
      type === "select"
        ? window.prompt("Dropdown options separated by commas", field.options?.join(", ") ?? "")?.split(",").map((option) => option.trim()).filter(Boolean)
        : undefined;
    updateDraft({ ...draftConfig, fields: { ...draftConfig.fields, [fieldId]: { label, type, required, options } } });
  }

  function assignField(fieldId: string) {
    if (!adminOperation || adminOperation.requiredFields.includes(fieldId)) return;
    updateOperation({ ...adminOperation, requiredFields: [...adminOperation.requiredFields, fieldId] });
  }

  function removeField(fieldId: string) {
    if (!adminOperation) return;
    updateOperation({ ...adminOperation, requiredFields: adminOperation.requiredFields.filter((item) => item !== fieldId) });
  }

  function addUser() {
    const id = window.prompt("User ID", "1201");
    if (!id) return;
    const name = window.prompt("User name", "Mahesh") ?? id;
    const roleAnswer = window.prompt("Role: operator, teamLead, or admin", "operator") ?? "operator";
    const role = roleAnswer === "teamLead" || roleAnswer === "admin" ? roleAnswer : "operator";
    const user: AppUserConfig = { id, name, role, access: allAccess };
    updateDraft({ ...draftConfig, employees: Array.from(new Set([...draftConfig.employees, id])), users: [...(draftConfig.users ?? []), user] });
  }

  function updateUser(user: AppUserConfig) {
    updateDraft({ ...draftConfig, users: (draftConfig.users ?? []).map((item) => (item.id === user.id ? user : item)) });
  }

  function deleteUser(userId: string) {
    if (!window.confirm(`Delete user ${userId}?`)) return;
    updateDraft({ ...draftConfig, users: (draftConfig.users ?? []).filter((user) => user.id !== userId) });
  }

  function updateSelectedPart(nextPart: PartConfig) {
    updateDraft({
      ...draftConfig,
      materials: draftConfig.materials.map((material) =>
        material.id !== adminMaterialId
          ? material
          : { ...material, parts: material.parts.map((part) => (part.id === adminPartId ? nextPart : part)) }
      )
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
        <p>Build routes, serial rules, users, and operation fields for the demo.</p>
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

      <nav className="admin-tabs" aria-label="Admin sections">
        {[
          ["route", "Route"],
          ["serial", "Serial Rules"],
          ["fields", "Fields"],
          ["users", "Users"],
          ["json", "JSON"]
        ].map(([id, label]) => (
          <button className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id as AdminTab)}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab !== "users" && activeTab !== "json" && (
        <section className="admin-selector-strip">
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
                <option key={material.id} value={material.id}>{material.name}</option>
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
                <option key={part.id} value={part.id}>{part.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Operation</span>
            <select value={adminOperationId} onChange={(event) => setAdminOperationId(event.target.value)}>
              <option value="">No operation</option>
              {adminPart?.operations.map((operation) => (
                <option key={operation.id} value={operation.id}>{operation.name}</option>
              ))}
            </select>
          </label>
        </section>
      )}

      {activeTab === "route" && (
        <section className="admin-panel-grid">
          <AdminList title="Materials" actions={<>
            <button onClick={addMaterial}><Plus size={18} />Add</button>
            <button onClick={renameMaterial}><Pencil size={18} />Rename</button>
            <button onClick={() => moveMaterial(-1)}><ArrowUp size={18} />Up</button>
            <button onClick={() => moveMaterial(1)}><ArrowDown size={18} />Down</button>
          </>}>
            {draftConfig.materials.map((material) => (
              <button
                className={material.id === adminMaterialId ? "selected" : ""}
                key={material.id}
                onClick={() => {
                  setAdminMaterialId(material.id);
                  setAdminPartId(material.parts[0]?.id ?? "");
                  setAdminOperationId(material.parts[0]?.operations[0]?.id ?? "");
                }}
              >
                {material.name}
              </button>
            ))}
          </AdminList>
          <AdminList title="Parts" actions={<>
            <button onClick={addPart}><Plus size={18} />Add</button>
            <button onClick={renamePart}><Pencil size={18} />Rename</button>
            <button onClick={() => movePart(-1)}><ArrowUp size={18} />Up</button>
            <button onClick={() => movePart(1)}><ArrowDown size={18} />Down</button>
          </>}>
            {adminMaterial?.parts.map((part) => (
              <button
                className={part.id === adminPartId ? "selected" : ""}
                key={part.id}
                onClick={() => {
                  setAdminPartId(part.id);
                  setAdminOperationId(part.operations[0]?.id ?? "");
                }}
              >
                {part.name}
              </button>
            ))}
          </AdminList>
          <AdminList title="Operations" actions={<>
            <button onClick={addOperation}><Plus size={18} />Add</button>
            <button onClick={() => adminOperation && updateOperation({ ...adminOperation, name: window.prompt("Operation name", adminOperation.name) || adminOperation.name })}><Pencil size={18} />Rename</button>
            <button onClick={() => moveOperation(-1)}><ArrowUp size={18} />Up</button>
            <button onClick={() => moveOperation(1)}><ArrowDown size={18} />Down</button>
            <button className="danger-mini" onClick={deleteOperation}><Trash2 size={18} />Delete</button>
          </>}>
            {adminPart?.operations.map((operation, index) => (
              <button className={operation.id === adminOperationId ? "selected" : ""} key={operation.id} onClick={() => setAdminOperationId(operation.id)}>
                <span>{index + 1}. {operation.name}</span>
              </button>
            ))}
          </AdminList>
        </section>
      )}

      {activeTab === "serial" && (
        <section className="admin-card">
          <h2>{adminPart?.name ?? "Part"} Serial Rules</h2>
          <p className="muted-text">These rules belong only to this part. Changing Mainframe rules will not affect Hinge, Front Frame, or other parts.</p>
          <dl className="rule-summary">
            <div><dt>Examples</dt><dd>{adminPart?.serialExample || "No examples configured"}</dd></div>
            <div><dt>Accepted regex rules</dt><dd>{adminPart?.serialPatterns?.join(" | ") || "No serial rules configured"}</dd></div>
          </dl>
          <button className="secondary-button" onClick={editPartSerialRules}>
            <Pencil size={22} />
            Edit serial rules
          </button>
        </section>
      )}

      {activeTab === "fields" && (
        <section className="field-builder clean-field-builder">
          <div className="field-library">
            <div className="section-title-row">
              <h2>Field Library</h2>
              <button className="secondary-button" onClick={addFieldDefinition}><Plus size={18} />Create field</button>
            </div>
            {Object.entries(draftConfig.fields).map(([fieldId, field]) => (
              <span className="field-chip" draggable key={fieldId} onDragStart={(event) => event.dataTransfer.setData("text/plain", fieldId)}>
                <button onClick={() => assignField(fieldId)}>{field.label}</button>
                <button onClick={() => editField(fieldId)} aria-label={`Edit ${field.label}`}><Pencil size={15} /></button>
              </span>
            ))}
          </div>
          <div className="operation-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => assignField(event.dataTransfer.getData("text/plain"))}>
            <h2>{adminOperation?.name ?? "Select an operation"}</h2>
            <label className="field compact-field">
              <span>Camera / OCR</span>
              <select
                value={adminOperation?.captureMode ?? "ocr"}
                onChange={(event) => adminOperation && updateOperation({ ...adminOperation, captureMode: event.target.value === "none" ? "none" : "ocr" })}
              >
                <option value="ocr">Available</option>
                <option value="none">Not required</option>
              </select>
            </label>
            <div className="assigned-fields">
              {adminOperation?.requiredFields.map((fieldId) => (
                <span className="assigned-field" key={fieldId}>
                  {draftConfig.fields[fieldId]?.label ?? fieldId}
                  <button onClick={() => removeField(fieldId)} aria-label={`Remove ${fieldId}`}><X size={16} /></button>
                </span>
              ))}
              {adminOperation && adminOperation.requiredFields.length === 0 && <span className="muted-text">No fields assigned</span>}
            </div>
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className="admin-card">
          <div className="section-title-row">
            <div>
              <h2>Users and Access</h2>
              <p className="muted-text">Operators see only assigned parts and operations. Team leads can manually add serials for investigation.</p>
            </div>
            <button className="secondary-button" onClick={addUser}><Plus size={18} />Create user</button>
          </div>
          <div className="user-grid">
            {(draftConfig.users ?? []).map((user) => (
              <article className="user-card" key={user.id}>
                <strong>{user.id} - {user.name}</strong>
                <label className="field compact-field">
                  <span>Role</span>
                  <select value={user.role} onChange={(event) => updateUser({ ...user, role: event.target.value as AppUserConfig["role"] })}>
                    <option value="operator">Operator</option>
                    <option value="teamLead">Team Lead</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <span>{user.access.length} part access rule{user.access.length === 1 ? "" : "s"}</span>
                <button className="secondary-button" onClick={() => updateUser({ ...user, access: allAccess })}>Give all access</button>
                <div className="access-matrix">
                  {draftConfig.materials.map((material) =>
                    material.parts.map((part) => {
                      const access = user.access.find((item) => item.materialId === material.id && item.partId === part.id);
                      const hasPartAccess = Boolean(access);
                      return (
                        <details key={`${user.id}-${part.id}`}>
                          <summary>
                            <label>
                              <input
                                type="checkbox"
                                checked={hasPartAccess}
                                onChange={(event) => {
                                  const withoutPart = user.access.filter((item) => !(item.materialId === material.id && item.partId === part.id));
                                  updateUser({
                                    ...user,
                                    access: event.target.checked
                                      ? [...withoutPart, { materialId: material.id, partId: part.id, operationIds: part.operations.map((operation) => operation.id) }]
                                      : withoutPart
                                  });
                                }}
                              />
                              {material.name} / {part.name}
                            </label>
                          </summary>
                          {part.operations.map((operation) => (
                            <label className="access-operation" key={operation.id}>
                              <input
                                type="checkbox"
                                checked={access?.operationIds.includes(operation.id) ?? false}
                                disabled={!hasPartAccess}
                                onChange={(event) => {
                                  const currentAccess = access ?? { materialId: material.id, partId: part.id, operationIds: [] };
                                  const operationIds = event.target.checked
                                    ? Array.from(new Set([...currentAccess.operationIds, operation.id]))
                                    : currentAccess.operationIds.filter((id) => id !== operation.id);
                                  updateUser({
                                    ...user,
                                    access: [
                                      ...user.access.filter((item) => !(item.materialId === material.id && item.partId === part.id)),
                                      { ...currentAccess, operationIds }
                                    ]
                                  });
                                }}
                              />
                              {operation.name}
                            </label>
                          ))}
                        </details>
                      );
                    })
                  )}
                </div>
                <button className="secondary-button danger-button" onClick={() => deleteUser(user.id)}><Trash2 size={18} />Delete</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "json" && (
        <section className="admin-card">
          <h2>Advanced JSON</h2>
          <textarea className="json-editor visible-json-editor" value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} />
        </section>
      )}

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
      <div className="button-row">
        <button className="primary-button" onClick={saveConfig}><Save size={22} />Save</button>
        <button className="secondary-button" onClick={downloadConfig}><Download size={22} />Export JSON</button>
        <button className="secondary-button" onClick={() => { resetAppConfig(); window.location.reload(); }}><RotateCcw size={22} />Reset local</button>
      </div>
    </main>
  );
}

function AdminList({ title, actions, children }: { title: string; actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="admin-list-card">
      <div className="section-title-row">
        <h2>{title}</h2>
      </div>
      <div className="admin-mini-actions">{actions}</div>
      <div className="admin-sequence-list">{children}</div>
    </section>
  );
}

function promptSerialPatterns() {
  const kind = window.prompt("Serial rule type: digits, prefix, or custom", "digits")?.toLowerCase();
  if (kind === "prefix") {
    const prefix = window.prompt("Prefix letters", "H")?.toUpperCase() ?? "H";
    const digits = Number(window.prompt("Number of digits", "6") ?? "6");
    return [`^${prefix}[0-9]{${digits}}$`];
  }
  if (kind === "custom") {
    return (window.prompt("Regex rules separated by commas", "^[A-Z0-9]{3,12}$") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const digits = Number(window.prompt("Number of digits", "7") ?? "7");
  return [`^[0-9]{${digits}}$`];
}

function validateConfig(config: AppConfig) {
  if (!Array.isArray(config.materials) || config.materials.length === 0) {
    throw new Error("Config must include at least one material.");
  }
  config.materials.forEach((material) => {
    material.parts.forEach((part) => {
      part.serialPatterns?.forEach((pattern) => new RegExp(pattern));
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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
