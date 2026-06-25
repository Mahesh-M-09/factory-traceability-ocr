import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { OperatorShell } from "../components/OperatorShell";
import { canAccessPart } from "../services/operatorService";
import { findMaterial } from "../services/selection";

export function PartSelectionPage() {
  const { config, operatorId, selectedMaterialId, setSelectedPartId, setSelectedOperationId, setCapture, setPendingRecord } =
    useAppContext();
  const navigate = useNavigate();
  const material = findMaterial(config, selectedMaterialId);
  const parts = material?.parts.filter((part) => canAccessPart(operatorId, selectedMaterialId, part.id, config)) ?? [];

  return (
    <OperatorShell>
      <button className="back-button" onClick={() => navigate("/materials")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>{material?.name ?? "Parts"}</h1>
        <p>Select the part moving through production.</p>
      </div>
      <section className="choice-grid">
        {parts.map((part) => (
          <button
            className="choice-button"
            key={part.id}
            onClick={() => {
              setSelectedPartId(part.id);
              setSelectedOperationId("");
              setCapture(null);
              setPendingRecord(null);
              navigate("/operations");
            }}
          >
            <span>{part.name}</span>
            <ChevronRight size={34} />
          </button>
        ))}
      </section>
    </OperatorShell>
  );
}
