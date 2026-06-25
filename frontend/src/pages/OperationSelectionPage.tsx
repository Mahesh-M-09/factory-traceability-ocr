import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { OperatorShell } from "../components/OperatorShell";
import { getOperationHistory, loadDemoRecords } from "../services/demoDatabaseService";
import { canAccessOperation } from "../services/operatorService";
import { findMaterial, findPart } from "../services/selection";
import { getTodayKey, isSameLocalDay, loadProductionTargets } from "../services/targetService";

export function OperationSelectionPage() {
  const { config, operatorId, selectedMaterialId, selectedPartId, setSelectedOperationId, setCapture, setPendingRecord } = useAppContext();
  const navigate = useNavigate();
  const material = findMaterial(config, selectedMaterialId);
  const part = findPart(config, selectedMaterialId, selectedPartId);
  const operations = part?.operations.filter((operation) =>
    canAccessOperation(operatorId, selectedMaterialId, selectedPartId, operation.id, config)
  ) ?? [];
  const todayKey = getTodayKey();
  const todayTargets = loadProductionTargets().filter((target) => target.date === todayKey);
  const todayHistory = getOperationHistory(loadDemoRecords()).filter((row) => isSameLocalDay(row.timestamp, todayKey));

  function getOperationTarget(operationName: string) {
    const target = todayTargets.find((item) => item.material === material?.name && item.part === part?.name && item.operation === operationName)?.targetQty ?? 0;
    const done = todayHistory.filter((row) => row.material === material?.name && row.part === part?.name && row.operation === operationName).length;
    return { done, pending: Math.max(target - done, 0), target };
  }

  return (
    <OperatorShell>
      <button className="back-button" onClick={() => navigate("/parts")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>{part?.name ?? "Operations"}</h1>
        <p>{material?.name} production route.</p>
      </div>
      {part && operations.length === 0 ? (
        <section className="empty-state">
          <h2>No operations configured</h2>
          <p>Use Admin Config to add operations for this part.</p>
        </section>
      ) : (
        <section className="operation-grid">
          {operations.map((operation) => (
            <OperationButton
              key={operation.id}
              name={operation.name}
              target={getOperationTarget(operation.name)}
              onClick={() => {
                setSelectedOperationId(operation.id);
                setCapture(null);
                setPendingRecord(null);
                navigate(operation.captureMode === "none" ? "/form" : "/capture");
              }}
            />
          ))}
        </section>
      )}
    </OperatorShell>
  );
}

function OperationButton({ name, onClick, target }: { name: string; onClick: () => void; target: { done: number; pending: number; target: number } }) {
  return (
    <button className="operation-button operation-button-with-target" onClick={onClick}>
      <span>{name}</span>
      <small>
        {target.target > 0 ? `${target.done}/${target.target} done, ${target.pending} pending` : `${target.done} completed today`}
      </small>
      <ChevronRight size={32} />
    </button>
  );
}
