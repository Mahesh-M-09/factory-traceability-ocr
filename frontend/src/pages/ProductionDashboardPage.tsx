import { ChevronLeft, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { getOperationHistory, getReworkHistory, loadDemoRecords } from "../services/demoDatabaseService";
import { getTodayKey, isSameLocalDay, loadProductionTargets } from "../services/targetService";

export function ProductionDashboardPage() {
  const { config } = useAppContext();
  const [date, setDate] = useState(getTodayKey());
  const records = loadDemoRecords();
  const targets = loadProductionTargets().filter((target) => target.date === date);
  const operations = getOperationHistory(records).filter((row) => isSameLocalDay(row.timestamp, date));
  const rework = getReworkHistory(records).filter((row) => isSameLocalDay(row.openedAt, date));
  const navigate = useNavigate();
  const [selectedTile, setSelectedTile] = useState<{ material: string; part: string; operation: string } | null>(null);

  const rows = useMemo(() => {
    const partKeys = new Map<string, { material: string; part: string; operations: string[] }>();
    records.forEach((record) => {
      const key = `${record.material} / ${record.part}`;
      const existing = partKeys.get(key);
      partKeys.set(key, {
        material: record.material,
        part: record.part,
        operations: Array.from(new Set([...(existing?.operations ?? []), ...record.events.map((event) => event.operation)]))
      });
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

  const completedCount = operations.length;
  const targetCount = targets.reduce((total, target) => total + target.targetQty, 0);
  const reworkCount = rework.length;
  const scrapCount = records.filter((record) => record.status === "Scrap" && record.events.some((event) => isSameLocalDay(event.dateTime, date))).length;
  const completionPercent = targetCount ? Math.min(100, Math.round((completedCount / targetCount) * 100)) : completedCount > 0 ? 100 : 0;
  const selectedRows = selectedTile
    ? operations.filter(
        (event) =>
          event.material === selectedTile.material &&
          event.part === selectedTile.part &&
          event.operation === selectedTile.operation
      )
    : [];
  const selectedTarget = selectedTile
    ? targets.find(
        (target) =>
          target.material === selectedTile.material &&
          target.part === selectedTile.part &&
          target.operation === selectedTile.operation
      )?.targetQty ?? 0
    : 0;
  const selectedOperators = selectedRows.reduce<Record<string, number>>((summary, row) => {
    summary[row.operatorId] = (summary[row.operatorId] ?? 0) + 1;
    return summary;
  }, {});
  const selectedAssignedOperators = selectedTile
    ? (config.users ?? []).filter((user) =>
        user.access.some((access) => {
          const material = config.materials.find((item) => item.id === access.materialId);
          const part = material?.parts.find((item) => item.id === access.partId);
          const operation = part?.operations.find((item) => item.id === selectedTile.operation || item.name === selectedTile.operation);
          return (
            material?.name === selectedTile.material &&
            part?.name === selectedTile.part &&
            Boolean(operation) &&
            access.operationIds.includes(operation.id)
          );
        })
      )
    : [];

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

      <section className="dashboard-hero-progress">
        <div>
          <span>Overall completion</span>
          <strong>{completionPercent}%</strong>
          <p>Daily station performance against uploaded targets. {Math.max(targetCount - completedCount, 0)} checks still open.</p>
        </div>
        <div className="production-progress-track">
          <div className="production-progress-fill" style={{ width: `${completionPercent}%` }}>
            <span className="brazer-marker">BRAZE</span>
          </div>
        </div>
      </section>

      <section className="dashboard-kpis">
        <div><span>Rework</span><strong>{reworkCount}</strong></div>
        <div><span>Scrap</span><strong>{scrapCount}</strong></div>
        <div><span>Active operators</span><strong>{new Set(operations.map((event) => event.operatorId)).size}</strong></div>
        <div><span>Operation rows</span><strong>{rows.length}</strong></div>
      </section>

      <section className="dashboard-part-list">
        {rows.map((row) => (
          <article className="dashboard-part-row" key={`${row.material}-${row.part}`}>
            <div className="dashboard-part-title">
              <span>Part</span>
              <strong>{row.material} / {row.part}</strong>
            </div>
            <div className="dashboard-operation-tiles">
              {row.operations.sort().map((operation) => {
                  const done = operations.filter((event) => event.material === row.material && event.part === row.part && event.operation === operation).length;
                  const target = targets.find((item) => item.material === row.material && item.part === row.part && item.operation === operation)?.targetQty ?? 0;
                  const percent = target ? Math.min(100, Math.round((done / target) * 100)) : done > 0 ? 100 : 0;
                  const statusClass = target === 0 && done === 0 ? "idle" : done >= target && target > 0 ? "good" : percent >= 70 ? "warn" : "bad";
                  return (
                    <button
                      className={`dashboard-operation-tile ${statusClass}`}
                      key={`${row.material}-${row.part}-${operation}`}
                      onClick={() => setSelectedTile({ material: row.material, part: row.part, operation })}
                    >
                      <span
                        className="station-dial"
                        style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties & Record<"--progress", string>}
                      >
                        <strong>{done}</strong>
                        <small>/{target || "-"}</small>
                      </span>
                      <span className="station-tile-copy">
                        <span>{operation}</span>
                        <small>{percent}% complete</small>
                      </span>
                    </button>
                  );
                })}
            </div>
          </article>
        ))}
      </section>

      {selectedTile && (
        <section className="dashboard-detail-panel">
          <button className="table-action-button" onClick={() => setSelectedTile(null)}>Close</button>
          <h2>{selectedTile.part} · {selectedTile.operation}</h2>
          <p>{selectedRows.length}/{selectedTarget || "-"} completed on {date}</p>
          <div className="operator-summary-grid">
            {selectedAssignedOperators.map((operator) => (
              <div className="operator-summary-card" key={operator.id}>
                <span><Users size={16} /> {operator.id}</span>
                <strong>{selectedOperators[operator.id] ?? 0}</strong>
                <small>{operator.name} · {selectedOperators[operator.id] ? "active today" : "no submissions"}</small>
              </div>
            ))}
            {selectedAssignedOperators.length === 0 &&
              Object.entries(selectedOperators).map(([operator, count]) => (
                <div className="operator-summary-card" key={operator}>
                  <span><Users size={16} /> {operator}</span>
                  <strong>{count}</strong>
                  <small>Submitted today</small>
                </div>
              ))}
            {selectedAssignedOperators.length === 0 && Object.keys(selectedOperators).length === 0 && (
              <span className="muted-text">No assigned operator submissions yet.</span>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
