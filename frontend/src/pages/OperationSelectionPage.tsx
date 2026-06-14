import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";

export function OperationSelectionPage() {
  const { config, setSelectedOperationId, setCapture, setPendingRecord } = useAppContext();
  const navigate = useNavigate();

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Select Operation</h1>
        <p>Choose the station for this frame.</p>
      </div>
      <section className="operation-grid">
        {config.operations.map((operation) => (
          <button
            className="operation-button"
            key={operation.id}
            onClick={() => {
              setSelectedOperationId(operation.id);
              setCapture(null);
              setPendingRecord(null);
              navigate("/capture");
            }}
          >
            <span>{operation.name}</span>
            <ChevronRight size={32} />
          </button>
        ))}
      </section>
    </main>
  );
}
