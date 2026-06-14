import { Download, RotateCcw, Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAppContext } from "../App";
import { resetAppConfig, saveAppConfig } from "../services/configService";
import type { AppConfig } from "../types/config";

export function AdminConfigPage() {
  const { config, setConfig } = useAppContext();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
        <p>Edit operations, fields, frame types, OCR rules, and employee IDs.</p>
      </div>
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
  if (!Array.isArray(config.operations) || config.operations.length === 0) {
    throw new Error("Config must include at least one operation.");
  }
  if (!Array.isArray(config.frameTypes) || config.frameTypes.length === 0) {
    throw new Error("Config must include at least one frame type.");
  }
  config.frameTypes.forEach((frameType) => {
    new RegExp(frameType.serialPattern);
  });
}
