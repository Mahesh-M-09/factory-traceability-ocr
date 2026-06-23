import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { clearAdminUser, storeAdminUser, validateAdminLogin } from "../services/adminAuthService";
import { clearOperatorId, storeOperatorId, validateOperatorId } from "../services/operatorService";
import { endOperatorSession, startOperatorSession } from "../services/sessionLogService";

export function LoginPage() {
  const { config, setOperatorId, setAdminUser } = useAppContext();
  const [employeeId, setEmployeeId] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError("");

    try {
      const isValid = await validateOperatorId(employeeId, config);
      if (!isValid) {
        setError("Enter a valid 4-digit employee ID.");
        return;
      }

      clearAdminUser();
      storeOperatorId(employeeId);
      startOperatorSession(employeeId);
      setOperatorId(employeeId);
      setAdminUser("");
      navigate("/materials");
    } catch {
      setError("Employee validation failed. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  function handleAdminSubmit(event: FormEvent) {
    event.preventDefault();
    setAdminError("");
    if (!validateAdminLogin(adminName, adminPassword, config.adminCredentials)) {
      setAdminError("Enter the admin username and password.");
      return;
    }
    endOperatorSession();
    clearOperatorId();
    storeAdminUser(adminName);
    setOperatorId("");
    setAdminUser(adminName);
    navigate("/admin");
  }

  return (
    <main className="page narrow-page">
      <section className="login-panel">
        <h1>Operator Login</h1>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span>4-digit employee ID</span>
            <input
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value.replace(/\D/g, "").slice(0, 4))}
              autoFocus
            />
          </label>
          {error && <div className="error-message">{error}</div>}
          <button className="primary-button full-width" disabled={checking || employeeId.length !== 4}>
            {checking ? "Checking..." : "Continue"}
          </button>
        </form>
      </section>
      <section className="login-panel admin-login-panel">
        <h1>Admin Login</h1>
        <form onSubmit={handleAdminSubmit} className="stack">
          <label className="field">
            <span>Admin username</span>
            <input value={adminName} onChange={(event) => setAdminName(event.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span>Admin password</span>
            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {adminError && <div className="error-message">{adminError}</div>}
          <button className="secondary-button full-width" disabled={!adminName || !adminPassword}>
            Admin tools
          </button>
        </form>
      </section>
    </main>
  );
}
