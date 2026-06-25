import { ChevronLeft, Save, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { deleteProductionTarget, getTodayKey, loadProductionTargets, saveProductionTarget } from "../services/targetService";

export function TargetsPage() {
  const { adminUser, config } = useAppContext();
  const [targets, setTargets] = useState(loadProductionTargets());
  const [date, setDate] = useState(getTodayKey());
  const [shift, setShift] = useState("Day");
  const [materialId, setMaterialId] = useState(config.materials[0]?.id ?? "");
  const material = config.materials.find((item) => item.id === materialId) ?? config.materials[0];
  const [partId, setPartId] = useState(material?.parts[0]?.id ?? "");
  const part = material?.parts.find((item) => item.id === partId) ?? material?.parts[0];
  const [operationId, setOperationId] = useState(part?.operations[0]?.id ?? "");
  const operation = part?.operations.find((item) => item.id === operationId) ?? part?.operations[0];
  const [targetQty, setTargetQty] = useState("50");
  const [notes, setNotes] = useState("");
  const navigate = useNavigate();

  const visibleTargets = useMemo(
    () => targets.filter((target) => target.date === date).sort((a, b) => `${a.part}-${a.operation}`.localeCompare(`${b.part}-${b.operation}`)),
    [date, targets]
  );

  function submitTarget(event: FormEvent) {
    event.preventDefault();
    if (!material || !part || !operation) return;
    saveProductionTarget({
      date,
      shift,
      material: material.name,
      part: part.name,
      operation: operation.name,
      targetQty: Number(targetQty) || 0,
      notes,
      createdBy: adminUser || "Team Lead"
    });
    setTargets(loadProductionTargets());
    setNotes("");
  }

  function removeTarget(targetId: string) {
    if (!window.confirm("Delete this target?")) return;
    deleteProductionTarget(targetId);
    setTargets(loadProductionTargets());
  }

  return (
    <main className="page records-page">
      <button className="back-button" onClick={() => navigate("/admin")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>Operation Targets</h1>
        <p>Set daily operation targets. Operators inherit the target from the operation, not from a person.</p>
      </div>

      <form className="target-form admin-card" onSubmit={submitTarget}>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Shift</span>
          <select value={shift} onChange={(event) => setShift(event.target.value)}>
            <option>Day</option>
            <option>Late</option>
            <option>Night</option>
          </select>
        </label>
        <label className="field">
          <span>Material</span>
          <select
            value={materialId}
            onChange={(event) => {
              const nextMaterial = config.materials.find((item) => item.id === event.target.value);
              setMaterialId(event.target.value);
              setPartId(nextMaterial?.parts[0]?.id ?? "");
              setOperationId(nextMaterial?.parts[0]?.operations[0]?.id ?? "");
            }}
          >
            {config.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Part</span>
          <select
            value={partId}
            onChange={(event) => {
              const nextPart = material?.parts.find((item) => item.id === event.target.value);
              setPartId(event.target.value);
              setOperationId(nextPart?.operations[0]?.id ?? "");
            }}
          >
            {material?.parts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Operation</span>
          <select value={operationId} onChange={(event) => setOperationId(event.target.value)}>
            {part?.operations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Target quantity</span>
          <input type="number" min="0" value={targetQty} onChange={(event) => setTargetQty(event.target.value)} />
        </label>
        <label className="field">
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button className="primary-button">
          <Save size={22} />
          Save target
        </button>
      </form>

      <section className="records-table-wrap">
        <table className="records-table">
          <thead>
            <tr><th>Date</th><th>Shift</th><th>Part</th><th>Operation</th><th>Target</th><th>Notes</th><th>Admin</th></tr>
          </thead>
          <tbody>
            {visibleTargets.map((target) => (
              <tr key={target.id}>
                <td>{target.date}</td><td>{target.shift}</td><td>{target.material} / {target.part}</td><td>{target.operation}</td>
                <td>{target.targetQty}</td><td>{target.notes || "-"}</td>
                <td><button className="table-action-button" onClick={() => removeTarget(target.id)}><Trash2 size={16} /> Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
