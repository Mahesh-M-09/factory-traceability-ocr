import { ChevronLeft, Download, Search, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearDemoRecords,
  exportDemoRecordsCsv,
  importDemoRecordsCsv,
  loadDemoRecords
} from "../services/demoDatabaseService";

export function RecordsPage() {
  const [records, setRecords] = useState(loadDemoRecords());
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) {
      return records;
    }
    return records.filter(
      (record) =>
        record.serialNumber.toUpperCase().includes(needle) ||
        record.linkedHingeSerial.toUpperCase().includes(needle) ||
        record.batchNumber.toUpperCase().includes(needle)
    );
  }, [query, records]);

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
    setRecords(loadDemoRecords());
    setMessage(`Imported ${count} record${count === 1 ? "" : "s"}.`);
    event.target.value = "";
  }

  function clearRecords() {
    if (!window.confirm("Clear all local demo records on this device?")) {
      return;
    }
    clearDemoRecords();
    setRecords([]);
    setMessage("Demo database cleared.");
  }

  return (
    <main className="page records-page">
      <button className="back-button" onClick={() => navigate("/materials")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>Demo Database</h1>
        <p>Saved browser records for the trial process. Export to CSV or upload edited CSV back for testing.</p>
      </div>

      <section className="records-toolbar">
        <label className="field">
          <span>Search serial / hinge / batch</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
        </label>
        <button className="primary-button" onClick={exportCsv} disabled={filteredRecords.length === 0}>
          <Download size={22} />
          Export CSV
        </button>
        <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={22} />
          Upload CSV
        </button>
        <button className="secondary-button danger-button" onClick={clearRecords} disabled={records.length === 0}>
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

      {filteredRecords.length === 0 ? (
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
                <th>Part</th>
                <th>Status</th>
                <th>Hinge link</th>
                <th>Last operation</th>
                <th>Operator</th>
                <th>Cycle time</th>
                <th>Rework log</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const lastEvent = record.events.at(-1);
                return (
                  <tr key={record.serialNumber}>
                    <td>{record.serialNumber}</td>
                    <td>{record.material} / {record.part}</td>
                    <td>{record.status}</td>
                    <td>{record.linkedHingeSerial || "-"}</td>
                    <td>{lastEvent?.operation ?? "-"}</td>
                    <td>{lastEvent?.operatorId ?? "-"}</td>
                    <td>{lastEvent?.cycleTimeSeconds ? `${lastEvent.cycleTimeSeconds}s` : "-"}</td>
                    <td>{record.reworkLog.join(" | ") || "-"}</td>
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
