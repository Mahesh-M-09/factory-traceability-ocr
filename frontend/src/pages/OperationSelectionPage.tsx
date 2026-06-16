import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { findMaterial, findPart } from "../services/selection";

export function OperationSelectionPage() {
  const { config, selectedMaterialId, selectedPartId, setSelectedOperationId, setCapture, setPendingRecord } = useAppContext();
  const navigate = useNavigate();
  const material = findMaterial(config, selectedMaterialId);
  const part = findPart(config, selectedMaterialId, selectedPartId);

  return (
    <main className="page">
      <button className="back-button" onClick={() => navigate("/parts")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>{part?.name ?? "Operations"}</h1>
        <p>{material?.name} production route.</p>
      </div>
      {part && part.operations.length === 0 ? (
        <section className="empty-state">
          <h2>No operations configured</h2>
          <p>Use Admin Config to add operations for this part.</p>
        </section>
      ) : (
        <section className="operation-grid">
          {part?.operations.map((operation) => (
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
    </main>
  );
}
