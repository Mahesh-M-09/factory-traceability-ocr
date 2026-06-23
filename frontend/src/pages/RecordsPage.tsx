import { ChevronLeft, Download, Plus, Search, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import {
  addManualDemoRecord,
  clearDemoRecords,
  deleteDemoRecord,
  exportDemoRecordsCsv,
  getDemoTables,
  importDemoRecordsCsv,
  loadDemoRecords
} from "../services/demoDatabaseService";
import { loadOperationVisitLogs, loadOperatorSessionLogs } from "../services/sessionLogService";

export function RecordsPage() {
  const { adminUser, config, operatorId } = useAppContext();
  const [records, setRecords] = useState(loadDemoRecords());
  const [query, setQuery] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [view, setView] = useState<"records" | "sessions" | "operationLogs">("records");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const isAdmin = Boolean(adminUser);
  const tableNames = getDemoTables(records);
  const sessionLogs = loadOperatorSessionLogs();
  const operationLogs = loadOperationVisitLogs();

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return records.filter((record) => {
      const tableMatches = tableFilter === "all" || record.tableName === tableFilter;
      if (!tableMatches) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        record.serialNumber.toUpperCase().includes(needle) ||
        record.linkedHingeSerial.toUpperCase().includes(needle) ||
        record.batchNumber.toUpperCase().includes(needle)
      );
    });
  }, [query, records, tableFilter]);

  const filteredOperationLogs = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) {
      return operationLogs;
    }
    return operationLogs.filter(
      (log) =>
        log.operatorId.includes(needle) ||
        log.operation.toUpperCase().includes(needle) ||
        log.material.toUpperCase().includes(needle) ||
        log.part.toUpperCase().includes(needle)
    );
  }, [operationLogs, query]);

  const filteredSessionLogs = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) {
      return sessionLogs;
    }
    return sessionLogs.filter((log) => log.operatorId.includes(needle));
  }, [query, sessionLogs]);

  function refreshRecords() {
    setRecords(loadDemoRecords());
  }

  function exportCsv() {
    const csv = exportDemoRecordsCsv(filteredRecords);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "traceability-demo-records.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const count = importDemoRecordsCsv(await file.text());
    refreshRecords();
    setMessage(`Imported ${count} record${count === 1 ? "" : "s"}.`);
    event.target.value = "";
  }

  function clearRecords() {
    if (!window.confirm("Clear all local demo records on this device?")) {
      return;
    }
    clearDemoRecords();
    refreshRecords();
    setMessage("Demo database cleared.");
  }

  function addManualRecord() {
    const material = window.prompt("Material", config.materials[0]?.name ?? "Steel");
    if (!material) {
      return;
    }
    const part = window.prompt("Part", config.materials.find((item) => item.name === material)?.parts[0]?.name ?? "Mainframe");
    if (!part) {
      return;
    }
    const serialNumber = window.prompt("Serial number to add");
    if (!serialNumber) {
      return;
    }
    const batchNumber = window.prompt("Batch / reason", "Team lead manual add") ?? "Team lead manual add";
    addManualDemoRecord({
      material,
      part,
      serialNumber,
      batchNumber,
      requiresInvestigation: window.confirm("Mark this row for later investigation?")
    });
    refreshRecords();
    setMessage("Manual team-lead record added.");
  }

  function deleteRecord(serialNumber: string) {
    if (!window.confirm(`Delete ${serialNumber} from this demo database?`)) {
      return;
    }
    deleteDemoRecord(serialNumber);
    refreshRecords();
    setMessage(`${serialNumber} deleted.`);
  }

  return (
    <main className="page records-page">
      <button className="back-button" onClick={() => navigate(operatorId ? "/materials" : "/admin")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>Demo Database</h1>
        <p>Saved browser records for the trial process. Export to CSV or upload edited CSV back for testing.</p>
      </div>

      <section className="records-toolbar">
        <label className="field">
          <span>Search serial / hinge / batch / operator</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>Table</span>
          <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)}>
            <option value="all">All part tables</option>
            {tableNames.map((tableName) => (
              <option key={tableName} value={tableName}>
                {tableName}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && (
          <label className="field">
            <span>Admin view</span>
            <select value={view} onChange={(event) => setView(event.target.value as "records" | "sessions" | "operationLogs")}>
              <option value="records">Part records</option>
              <option value="sessions">Operator sign in/out</option>
              <option value="operationLogs">Operation time logs</option>
            </select>
          </label>
        )}
        <button className="primary-button" onClick={exportCsv} disabled={filteredRecords.length === 0}>
          <Download size={22} />
          Export CSV
        </button>
        {isAdmin && (
          <button className="secondary-button" onClick={addManualRecord}>
            <Plus size={22} />
            Add record
          </button>
        )}
        <button className="secondary-button" onClick={() => fileInputRef.current?.click()} disabled={!isAdmin}>
          <Upload size={22} />
          Upload CSV
        </button>
        <button className="secondary-button danger-button" onClick={clearRecords} disabled={!isAdmin || records.length === 0}>
          <Trash2 size={22} />
          Clear
        </button>
        <input ref={fileInputRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={importCsv} />
      </section>

      {message && <div className="success-message">{message}</div>}

      <section className="records-summary">
        <div>
          <span>Total records</span>
          <strong>{records.length}</strong>
        </div>
        <div>
          <span>Showing</span>
          <strong>{filteredRecords.length}</strong>
        </div>
        <div>
          <span>Scrap / hold</span>
          <strong>{records.filter((record) => record.status === "Scrap" || record.status === "Hold").length}</strong>
        </div>
      </section>

      {view === "sessions" && isAdmin ? (
        <section className="records-table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Signed in</th>
                <th>Signed out</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessionLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.operatorId}</td>
                  <td>{new Date(log.signedInAt).toLocaleString()}</td>
                  <td>{log.signedOutAt ? new Date(log.signedOutAt).toLocaleString() : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : view === "operationLogs" && isAdmin ? (
        <section className="records-table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Operator</th>
                <th>Part table</th>
                <th>Entered</th>
                <th>Exited</th>
                <th>Time spent</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperationLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.operation}</td>
                  <td>{log.operatorId}</td>
                  <td>{log.material}_{log.part}</td>
                  <td>{new Date(log.enteredAt).toLocaleString()}</td>
                  <td>{new Date(log.exitedAt).toLocaleString()}</td>
                  <td>{log.seconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : filteredRecords.length === 0 ? (
        <section className="empty-state">
          <Search size={42} />
          <h2>No records found</h2>
          <p>Create a stamping batch or upload a CSV to start the demo database.</p>
        </section>
      ) : (
        <section className="records-table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>MF serial</th>
                <th>Table</th>
                <th>Part</th>
                <th>Status</th>
                <th>Investigation</th>
                <th>Hinge link</th>
                <th>Last operation</th>
                <th>Operator</th>
                <th>Cycle time</th>
                <th>Rework log</th>
                {isAdmin && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const lastEvent = record.events.at(-1);
                return (
                  <tr key={record.serialNumber}>
                    <td>{record.serialNumber}</td>
                    <td>{record.tableName}</td>
                    <td>{record.material} / {record.part}</td>
                    <td>{record.status}</td>
                    <td>{record.requiresInvestigation ? "Yes" : "-"}</td>
                    <td>{record.linkedHingeSerial || "-"}</td>
                    <td>{lastEvent?.operation ?? "-"}</td>
                    <td>{lastEvent?.operatorId ?? "-"}</td>
                    <td>{lastEvent?.cycleTimeSeconds ? `${lastEvent.cycleTimeSeconds}s` : "-"}</td>
                    <td>{record.reworkLog.join(" | ") || "-"}</td>
                    {isAdmin && (
                      <td>
                        <button className="table-action-button" onClick={() => deleteRecord(record.serialNumber)}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
