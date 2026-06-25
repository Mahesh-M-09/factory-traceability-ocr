import { ChevronLeft } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOperationHistory, getReworkHistory, loadDemoRecords } from "../services/demoDatabaseService";
import { getTodayKey, isSameLocalDay, loadProductionTargets } from "../services/targetService";

export function ProductionDashboardPage() {
  const [date, setDate] = useState(getTodayKey());
  const records = loadDemoRecords();
  const targets = loadProductionTargets().filter((target) => target.date === date);
  const operations = getOperationHistory(records).filter((row) => isSameLocalDay(row.timestamp, date));
  const rework = getReworkHistory(records).filter((row) => isSameLocalDay(row.openedAt, date));
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const partKeys = new Map<string, { material: string; part: string; operations: string[] }>();
    records.forEach((record) => {
      const key = `${record.material} / ${record.part}`;
      partKeys.set(key, { material: record.material, part: record.part, operations: record.events.map((event) => event.operation) });
    });
    targets.forEach((target) => {
      const key = `${target.material} / ${target.part}`;
      const existing = partKeys.get(key);
      partKeys.set(key, {
        material: target.material,
        part: target.part,
        operations: Array.from(new Set([...(existing?.operations ?? []), target.operation]))
      });
    });
    return Array.from(partKeys.values()).sort((a, b) => `${a.material}-${a.part}`.localeCompare(`${b.material}-${b.part}`));
  }, [records, targets]);

  const operationNames = Array.from(new Set([...targets.map((target) => target.operation), ...operations.map((event) => event.operation)])).sort();
  const completedCount = operations.length;
  const targetCount = targets.reduce((total, target) => total + target.targetQty, 0);
  const reworkCount = rework.length;

  return (
    <main className="page dashboard-page">
      <button className="back-button" onClick={() => navigate(-1)}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="dashboard-heading">
        <div>
          <h1>Production Dashboard</h1>
          <p>Daily performance is counted from operation submissions completed on this date.</p>
        </div>
        <label className="field dashboard-date">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      <section className="dashboard-kpis">
        <div><span>Target</span><strong>{targetCount}</strong></div>
        <div><span>Completed</span><strong>{completedCount}</strong></div>
        <div><span>Pending</span><strong>{Math.max(targetCount - completedCount, 0)}</strong></div>
        <div><span>Rework</span><strong>{reworkCount}</strong></div>
      </section>

      <section className="dashboard-grid-wrap">
        <table className="dashboard-grid">
          <thead>
            <tr>
              <th>Part</th>
              {operationNames.map((operation) => <th key={operation}>{operation}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.material}-${row.part}`}>
                <td><strong>{row.material} / {row.part}</strong></td>
                {operationNames.map((operation) => {
                  const done = operations.filter((event) => event.material === row.material && event.part === row.part && event.operation === operation).length;
                  const target = targets.find((item) => item.material === row.material && item.part === row.part && item.operation === operation)?.targetQty ?? 0;
                  const percent = target ? Math.min(100, Math.round((done / target) * 100)) : done > 0 ? 100 : 0;
                  const statusClass = target === 0 && done === 0 ? "idle" : done >= target && target > 0 ? "good" : percent >= 70 ? "warn" : "bad";
                  const ringStyle = { "--metric": `${percent}%` } as CSSProperties & Record<"--metric", string>;
                  return (
                    <td key={`${row.material}-${row.part}-${operation}`}>
                      <div className={`metric-cell ${statusClass}`}>
                        <div className="metric-ring" style={ringStyle}>{percent}%</div>
                        <span>{done}/{target || "-"}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
