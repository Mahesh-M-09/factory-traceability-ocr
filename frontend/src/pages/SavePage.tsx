import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { OperatorShell } from "../components/OperatorShell";
import { saveOperation } from "../services/api";
import { findOperation } from "../services/selection";

export function SavePage() {
  const { config, selectedMaterialId, selectedPartId, selectedOperationId, pendingRecord, setCapture, setPendingRecord } =
    useAppContext();
  const [status, setStatus] = useState<"saving" | "success" | "error">("saving");
  const [message, setMessage] = useState("Saving to demo database...");
  const hasSaved = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!pendingRecord || hasSaved.current) {
      return;
    }
    hasSaved.current = true;

    saveOperation(pendingRecord)
      .then((result) => {
        setStatus("success");
        setMessage(result.message ?? "Record saved.");
      })
      .catch((error: Error) => {
        setStatus("error");
        setMessage(error.message);
      });
  }, [pendingRecord]);

  function nextFrame() {
    setCapture(null);
    setPendingRecord(null);
    const operation = findOperation(config, selectedMaterialId, selectedPartId, selectedOperationId);
    navigate(operation?.captureMode === "none" ? "/form" : "/capture");
  }

  return (
    <OperatorShell className="narrow-page">
      <section className="save-panel">
        {status === "saving" && <Loader2 className="spin" size={54} />}
        {status === "success" && <CheckCircle2 className="success-icon" size={58} />}
        {status === "error" && <CircleAlert className="error-icon" size={58} />}
        <h1>{status === "saving" ? "Saving" : status === "success" ? "Saved" : "Save failed"}</h1>
        <p>{message}</p>
        {pendingRecord && (
          <dl className="compact-summary">
            <div>
              <dt>Serial</dt>
              <dd>{pendingRecord.serialNumber}</dd>
            </div>
            <div>
              <dt>Material / Part</dt>
              <dd>
                {pendingRecord.material} / {pendingRecord.part}
              </dd>
            </div>
            <div>
              <dt>Operation</dt>
              <dd>{pendingRecord.operation}</dd>
            </div>
          </dl>
        )}
        <div className="button-row centered">
          {status === "error" && (
            <button className="secondary-button" onClick={() => window.location.reload()}>
              Try again
            </button>
          )}
          {status === "success" && (
            <button className="primary-button" onClick={nextFrame}>
              Next Frame
            </button>
          )}
        </div>
      </section>
    </OperatorShell>
  );
}
