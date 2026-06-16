import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { storeOperatorId, validateOperatorId } from "../services/operatorService";

export function LoginPage() {
  const { config, setOperatorId } = useAppContext();
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
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

      storeOperatorId(employeeId);
      setOperatorId(employeeId);
      navigate("/materials");
    } catch {
      setError("Employee validation failed. Please try again.");
    } finally {
      setChecking(false);
    }
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
    </main>
  );
}
