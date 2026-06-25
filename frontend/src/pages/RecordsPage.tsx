import { ChevronLeft, Download, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import {
  addManualDemoRecord,
  clearDemoRecords,
  deleteDemoRecord,
  exportDemoRecordsCsv,
  exportOperationHistoryCsv,
  exportReworkHistoryCsv,
  getDemoTables,
  getOperationHistory,
  getReworkHistory,
  importDemoRecordsCsv,
  loadDemoRecords
} from "../services/demoDatabaseService";
import { canManuallyAddSerial } from "../services/operatorService";
import { loadOperationVisitLogs, loadOperatorSessionLogs } from "../services/sessionLogService";

type RecordsView = "master" | "operations" | "rework" | "sessions" | "pageTime";
type SearchMode = "serial" | "all" | "batch" | "operator" | "operation";

export function RecordsPage() {
  const { adminUser, config, operatorId } = useAppContext();
  const [records, setRecords] = useState(loadDemoRecords());
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("serial");
  const [tableFilter, setTableFilter] = useState("all");
  const [view, setView] = useState<RecordsView>("master");
  const [message, setMessage] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualMaterialId, setManualMaterialId] = useState(config.materials[0]?.id ?? "");
  const [manualPartId, setManualPartId] = useState(config.materials[0]?.parts[0]?.id ?? "");
  const [manualSerial, setManualSerial] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualError, setManualError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const isAdmin = Boolean(adminUser);
  const canAddSerial = isAdmin || canManuallyAddSerial(operatorId, config);
  const tableNames = getDemoTables(records);
  const sessionLogs = loadOperatorSessionLogs();
  const pageTimeLogs = loadOperationVisitLogs();
  const operationHistory = getOperationHistory(records);
  const reworkHistory = getReworkHistory(records);
  const manualMaterial = config.materials.find((material) => material.id === manualMaterialId) ?? config.materials[0];
  const manualPart = manualMaterial?.parts.find((part) => part.id === manualPartId) ?? manualMaterial?.parts[0];

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return records.filter((record) => {
      const tableMatches = tableFilter === "all" || record.tableName === tableFilter;
      if (!tableMatches) return false;
      if (!needle) return true;
      if (searchMode === "serial") {
        return [record.serialNumber, record.linkedHingeSerial].some((value) => String(value ?? "").toUpperCase().includes(needle));
      }
      if (searchMode === "batch") {
        return String(record.batchNumber ?? "").toUpperCase().includes(needle);
      }
      if (searchMode === "operator") {
        return record.events.some((event) => String(event.operatorId ?? "").toUpperCase().includes(needle));
      }
      if (searchMode === "operation") {
        return record.events.some((event) => String(event.operation ?? "").toUpperCase().includes(needle));
      }
      return [record.serialNumber, record.linkedHingeSerial, record.batchNumber, record.part, record.material, record.status].some((value) =>
        String(value ?? "").toUpperCase().includes(needle)
      ) || record.events.some((event) => Object.values(event).some((value) => String(value).toUpperCase().includes(needle)));
    });
  }, [query, records, searchMode, tableFilter]);

  const filteredOperations = useMemo(() => filterRows(operationHistory, query, tableFilter, searchMode), [operationHistory, query, searchMode, tableFilter]);
  const filteredRework = useMemo(() => filterRows(reworkHistory, query, tableFilter, searchMode), [reworkHistory, query, searchMode, tableFilter]);

  function refreshRecords() {
    setRecords(loadDemoRecords());
  }

  function exportCsv() {
    const csv = view === "operations" ? exportOperationHistoryCsv(records) : view === "rework" ? exportReworkHistoryCsv(records) : exportDemoRecordsCsv(filteredRecords);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = view === "operations" ? "traceability-operation-history.csv" : view === "rework" ? "traceability-rework-log.csv" : "traceability-part-master.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const count = importDemoRecordsCsv(await file.text());
    refreshRecords();
    setMessage(`Imported ${count} master record${count === 1 ? "" : "s"}.`);
    event.target.value = "";
  }

  function clearRecords() {
    if (!window.confirm("Clear all local demo records on this device?")) return;
    clearDemoRecords();
    refreshRecords();
    setMessage("Demo database cleared.");
  }

  function addManualRecord(event: FormEvent) {
    event.preventDefault();
    setManualError("");
    const serial = manualSerial.trim().toUpperCase();
    if (!manualMaterial || !manualPart || !serial) return;
    if (manualPart.serialPatterns?.length && !manualPart.serialPatterns.some((pattern) => testPattern(pattern, serial))) {
      setManualError(`Serial must match ${manualPart.serialExample || manualPart.serialPatterns.join(", ")}.`);
      return;
    }
    addManualDemoRecord({
      material: manualMaterial.name,
      part: manualPart.name,
      serialNumber: serial,
      batchNumber: "Team lead manual add",
      requiresInvestigation: true,
      addedBy: adminUser || operatorId,
      notes: manualNotes
    });
    setManualSerial("");
    setManualNotes("");
    setShowManualForm(false);
    refreshRecords();
    setMessage("Manual serial added and marked for investigation.");
  }

  function deleteRecord(serialNumber: string) {
    if (!window.confirm(`Delete ${serialNumber} from this demo database?`)) return;
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
        <p>Part master, operation history, rework log, and admin-only session views for the trial process.</p>
      </div>

      <section className="records-toolbar">
        <label className="field">
          <span>Search serial / hinge / operation / operator</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>Search mode</span>
          <select value={searchMode} onChange={(event) => setSearchMode(event.target.value as SearchMode)}>
            <option value="serial">Serial / hinge only</option>
            <option value="operation">Operation</option>
            <option value="operator">Operator</option>
            <option value="batch">Batch</option>
            <option value="all">All fields</option>
          </select>
        </label>
        <label className="field">
          <span>Table</span>
          <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)}>
            <option value="all">All part tables</option>
            {tableNames.map((tableName) => <option key={tableName} value={tableName}>{tableName}</option>)}
          </select>
        </label>
        <label className="field">
          <span>View</span>
          <select value={view} onChange={(event) => setView(event.target.value as RecordsView)}>
            <option value="master">Part master</option>
            <option value="operations">Operation history</option>
            <option value="rework">Rework log</option>
            {isAdmin && <option value="sessions">Operator sign in/out</option>}
            {isAdmin && <option value="pageTime">Operation page time</option>}
          </select>
        </label>
        <button className="primary-button" onClick={exportCsv}>
          <Download size={22} />
          Export CSV
        </button>
        {canAddSerial && (
          <button className="secondary-button" onClick={() => setShowManualForm(true)}>
            <Plus size={22} />
            Add serial
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

      {showManualForm && (
        <form className="manual-record-panel" onSubmit={addManualRecord}>
          <button type="button" className="icon-only-button" onClick={() => setShowManualForm(false)} aria-label="Close manual add">
            <X size={20} />
          </button>
          <label className="field">
            <span>Material</span>
            <select
              value={manualMaterialId}
              onChange={(event) => {
                const material = config.materials.find((item) => item.id === event.target.value);
                setManualMaterialId(event.target.value);
                setManualPartId(material?.parts[0]?.id ?? "");
              }}
            >
              {config.materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Part</span>
            <select value={manualPartId} onChange={(event) => setManualPartId(event.target.value)}>
              {manualMaterial?.parts.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Serial</span>
            <input value={manualSerial} onChange={(event) => setManualSerial(event.target.value.toUpperCase())} autoComplete="off" />
          </label>
          <label className="field">
            <span>Investigation notes</span>
            <input value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} autoComplete="off" />
          </label>
          {manualError && <div className="error-message">{manualError}</div>}
          <button className="primary-button">Add for investigation</button>
        </form>
      )}

      {message && <div className="success-message">{message}</div>}

      <section className="records-summary">
        <div><span>Part master</span><strong>{records.length}</strong></div>
        <div><span>Operation rows</span><strong>{operationHistory.length}</strong></div>
        <div><span>Rework open</span><strong>{reworkHistory.filter((row) => row.status === "Open").length}</strong></div>
      </section>

      {view === "operations" ? (
        <Table columns={["Serial", "Table", "Operation", "Operator", "Jig", "Robot", "Result", "Cycle", "Time", "Notes"]}>
          {filteredOperations.map((row) => (
            <tr key={row.id}>
              <td>{row.serialNumber}</td><td>{row.tableName}</td><td>{row.operation}</td><td>{row.operatorId}</td><td>{row.jig || "-"}</td>
              <td>{row.robot || "-"}</td><td>{row.result || "-"}</td><td>{row.cycleTimeSeconds ? `${row.cycleTimeSeconds}s` : "-"}</td>
              <td>{new Date(row.timestamp).toLocaleString()}</td><td>{row.notes || "-"}</td>
            </tr>
          ))}
        </Table>
      ) : view === "rework" ? (
        <Table columns={["Serial", "Table", "Source operation", "Reason", "Notes", "Status", "Opened by", "Opened"]}>
          {filteredRework.map((row) => (
            <tr key={row.id}>
              <td>{row.serialNumber}</td><td>{row.tableName}</td><td>{row.sourceOperation}</td><td>{row.reason}</td>
              <td>{row.notes || "-"}</td><td>{row.status}</td><td>{row.openedBy || "-"}</td><td>{row.openedAt ? new Date(row.openedAt).toLocaleString() : "-"}</td>
            </tr>
          ))}
        </Table>
      ) : view === "sessions" && isAdmin ? (
        <Table columns={["Operator", "Signed in", "Signed out"]}>
          {sessionLogs.map((log) => <tr key={log.id}><td>{log.operatorId}</td><td>{new Date(log.signedInAt).toLocaleString()}</td><td>{log.signedOutAt ? new Date(log.signedOutAt).toLocaleString() : "Open"}</td></tr>)}
        </Table>
      ) : view === "pageTime" && isAdmin ? (
        <Table columns={["Operation", "Operator", "Part table", "Entered", "Exited", "Time spent"]}>
          {pageTimeLogs.map((log) => <tr key={log.id}><td>{log.operation}</td><td>{log.operatorId}</td><td>{log.material}_{log.part}</td><td>{new Date(log.enteredAt).toLocaleString()}</td><td>{new Date(log.exitedAt).toLocaleString()}</td><td>{log.seconds}s</td></tr>)}
        </Table>
      ) : filteredRecords.length === 0 ? (
        <section className="empty-state">
          <Search size={42} />
          <h2>No records found</h2>
          <p>Create a stamping batch, add a team-lead serial, or upload a CSV.</p>
        </section>
      ) : (
        <Table columns={["Serial", "Table", "Part", "Status", "Investigation", "Hinge link", "Operations", "Last operation", "Rework", ...(isAdmin ? ["Admin"] : [])]}>
          {filteredRecords.map((record) => {
            const lastEvent = record.events.at(-1);
            return (
              <tr key={record.serialNumber}>
                <td>{record.serialNumber}</td><td>{record.tableName}</td><td>{record.material} / {record.part}</td><td>{record.status}</td>
                <td>{record.requiresInvestigation ? "Yes" : "-"}</td><td>{record.linkedHingeSerial || "-"}</td><td>{record.events.length}</td>
                <td>{lastEvent?.operation ?? "-"}</td><td>{record.reworkLog.length ? `${record.reworkLog.length} item(s)` : "-"}</td>
                {isAdmin && <td><button className="table-action-button" onClick={() => deleteRecord(record.serialNumber)}>Delete</button></td>}
              </tr>
            );
          })}
        </Table>
      )}
    </main>
  );
}

function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <section className="records-table-wrap">
      <table className="records-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

function filterRows<T extends { tableName: string; serialNumber?: string; operation?: string; sourceOperation?: string; operatorId?: string; openedBy?: string; batchNumber?: string }>(
  rows: T[],
  query: string,
  tableFilter: string,
  searchMode: SearchMode
) {
  const needle = query.trim().toUpperCase();
  return rows.filter((row) => {
    if (tableFilter !== "all" && row.tableName !== tableFilter) return false;
    if (!needle) return true;
    if (searchMode === "serial") {
      return String(row.serialNumber ?? "").toUpperCase().includes(needle);
    }
    if (searchMode === "operation") {
      return [row.operation, row.sourceOperation].some((value) => String(value ?? "").toUpperCase().includes(needle));
    }
    if (searchMode === "operator") {
      return [row.operatorId, row.openedBy].some((value) => String(value ?? "").toUpperCase().includes(needle));
    }
    if (searchMode === "batch") {
      return String(row.batchNumber ?? "").toUpperCase().includes(needle);
    }
    return Object.values(row).some((value) => String(value).toUpperCase().includes(needle));
  });
}

function testPattern(pattern: string, value: string) {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}
