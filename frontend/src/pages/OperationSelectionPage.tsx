import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { OperatorShell } from "../components/OperatorShell";
import { canAccessOperation } from "../services/operatorService";
import { findMaterial, findPart } from "../services/selection";

export function OperationSelectionPage() {
  const { config, operatorId, selectedMaterialId, selectedPartId, setSelectedOperationId, setCapture, setPendingRecord } = useAppContext();
  const navigate = useNavigate();
  const material = findMaterial(config, selectedMaterialId);
  const part = findPart(config, selectedMaterialId, selectedPartId);
  const operations = part?.operations.filter((operation) =>
    canAccessOperation(operatorId, selectedMaterialId, selectedPartId, operation.id, config)
  ) ?? [];

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
            <button
              className="operation-button"
              key={operation.id}
              onClick={() => {
                setSelectedOperationId(operation.id);
                setCapture(null);
                setPendingRecord(null);
                navigate(operation.captureMode === "none" ? "/form" : "/capture");
              }}
            >
              <span>{operation.name}</span>
              <ChevronRight size={32} />
            </button>
          ))}
        </section>
      )}
    </OperatorShell>
  );
}
