import { ChevronLeft, Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { loadConnectionSettings, saveConnectionSettings } from "../services/connectionService";
import type { ConnectionSettings } from "../services/connectionService";

export function AdminConnectionsPage() {
  const { config } = useAppContext();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState<ConnectionSettings>(loadConnectionSettings());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function unlock(event: FormEvent) {
    event.preventDefault();
    if (password !== config.adminPassword) {
      setError("Incorrect admin password.");
      return;
    }
    setUnlocked(true);
    setError("");
  }

  function updateSetting<Key extends keyof ConnectionSettings>(key: Key, value: ConnectionSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("Unsaved connection changes.");
  }

  function saveSettings() {
    saveConnectionSettings(settings);
    setMessage("Connection settings saved on this iPad.");
    setError("");
  }

  if (!unlocked) {
    return (
      <main className="page narrow-page">
        <section className="login-panel">
          <button className="back-button" onClick={() => navigate("/admin")}>
            <ChevronLeft size={22} />
            Back
          </button>
          <h1>Connections</h1>
          <form className="stack" onSubmit={unlock}>
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
      <button className="back-button" onClick={() => navigate("/admin")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>Connections</h1>
        <p>Set demo endpoints for OCR and saving. Keep Azure Vision keys inside the backend, not in this web page.</p>
      </div>
      <section className="admin-builder connections-grid">
        <label className="field">
          <span>Save mode</span>
          <select
            value={settings.saveMode}
            onChange={(event) => updateSetting("saveMode", event.target.value === "googleSheet" ? "googleSheet" : "powerAutomate")}
          >
            <option value="powerAutomate">Power Automate / SharePoint</option>
            <option value="googleSheet">Google Sheet demo endpoint</option>
          </select>
        </label>
        <label className="field">
          <span>OCR API URL</span>
          <input
            value={settings.ocrApiUrl}
            placeholder="https://your-function.azurewebsites.net/api/ocr?code=..."
            onChange={(event) => updateSetting("ocrApiUrl", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Save API URL</span>
          <input
            value={settings.saveApiUrl}
            placeholder="Power Automate HTTP URL or Google Apps Script web app URL"
            onChange={(event) => updateSetting("saveApiUrl", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Read/search API URL</span>
          <input
            value={settings.readApiUrl}
            placeholder="Optional Google Apps Script read endpoint"
            onChange={(event) => updateSetting("readApiUrl", event.target.value)}
          />
        </label>
        <div className="connection-note">
          <h2>Azure OCR Key</h2>
          <p>Do not paste the Azure Vision key into this site. Put it in Azure Function app settings as `AZURE_VISION_KEY`.</p>
          <p>Use `AZURE_VISION_ENDPOINT` for the Vision resource endpoint, also inside Azure Function settings.</p>
        </div>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        <button className="primary-button" onClick={saveSettings}>
          <Save size={22} />
          Save connection settings
        </button>
      </section>
    </main>
  );
}
