import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { canAccessMaterial } from "../services/operatorService";

export function MaterialSelectionPage() {
  const { config, operatorId, setSelectedMaterialId, setSelectedPartId, setSelectedOperationId, setCapture, setPendingRecord } =
    useAppContext();
  const navigate = useNavigate();
  const materials = config.materials.filter((material) => canAccessMaterial(operatorId, material.id, config));

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Select Material</h1>
        <p>Choose the frame family before selecting the part.</p>
      </div>
      <section className="choice-grid material-grid">
        {materials.map((material) => (
          <button
            className="choice-button"
            key={material.id}
            onClick={() => {
              setSelectedMaterialId(material.id);
              setSelectedPartId("");
              setSelectedOperationId("");
              setCapture(null);
              setPendingRecord(null);
              navigate("/parts");
            }}
          >
            <span>{material.name}</span>
            <ChevronRight size={34} />
          </button>
        ))}
      </section>
    </main>
  );
}
