import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { findMaterial } from "../services/selection";

export function PartSelectionPage() {
  const { config, selectedMaterialId, setSelectedPartId, setSelectedOperationId, setCapture, setPendingRecord } =
    useAppContext();
  const navigate = useNavigate();
  const material = findMaterial(config, selectedMaterialId);

  return (
    <main className="page">
      <button className="back-button" onClick={() => navigate("/materials")}>
        <ChevronLeft size={22} />
        Back
      </button>
      <div className="page-heading">
        <h1>{material?.name ?? "Parts"}</h1>
        <p>Select the part moving through production.</p>
      </div>
      <section className="choice-grid">
        {material?.parts.map((part) => (
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
    </main>
  );
}
