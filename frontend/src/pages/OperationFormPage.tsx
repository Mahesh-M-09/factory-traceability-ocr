import { ChevronLeft } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { FieldRenderer } from "../components/FieldRenderer";
import { findDemoRecord } from "../services/demoDatabaseService";
import { findMaterial, findOperation, findPart } from "../services/selection";

export function OperationFormPage() {
  const { config, operatorId, selectedMaterialId, selectedPartId, selectedOperationId, capture, setPendingRecord } =
    useAppContext();
  const material = findMaterial(config, selectedMaterialId);
  const part = findPart(config, selectedMaterialId, selectedPartId);
  const operation = findOperation(config, selectedMaterialId, selectedPartId, selectedOperationId);
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const timerStartedAt = useRef(Date.now());

  const fields = useMemo(() => {
    return operation?.requiredFields.map((fieldId) => [fieldId, config.fields[fieldId]] as const).filter(([, field]) => field) ?? [];
  }, [config.fields, operation]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const missingField = fields.find(([fieldId, field]) => field.required && !formValues[fieldId]);
    if (missingField) {
      setError(`${missingField[1].label} is required.`);
      return;
    }

    if (!operation || !material || !part) {
      setError("Operation data is missing.");
      return;
    }

    const isStamping = operation.name.toLowerCase().includes("stamping");
    const scannedSerial = capture?.serialNumber.trim().toUpperCase() ?? "";
    if (!isStamping && scannedSerial && !findDemoRecord(scannedSerial)) {
      setError("Part not recognised. Complete stamping first or upload the serial into the demo database.");
      return;
    }

    const hingeSerial = formValues.hingeSerial?.trim().toUpperCase() ?? "";
    const needsHingeLink = operation.requiredFields.includes("hingeSerial");
    const hingeRecord = hingeSerial ? findDemoRecord(hingeSerial) : null;
    if (needsHingeLink && (!hingeRecord || !hingeRecord.part.toLowerCase().includes("hinge"))) {
      setError("Hinge part not recognised. Scan or enter a hinge serial already saved in the demo database.");
      return;
    }

    const cycleTimeSeconds = operation.captureMode === "none" ? 0 : Math.max(1, Math.round((Date.now() - timerStartedAt.current) / 1000));

    setPendingRecord({
      operatorId,
      material: material.name,
      part: part.name,
      operation: operation.name,
      serialNumber: capture?.serialNumber ?? formValues.startSerial?.trim().toUpperCase() ?? "",
      linkedHingeSerial: hingeSerial,
      cycleTimeSeconds,
      dateTime: new Date().toISOString(),
      ocrConfidence: capture?.confidence ?? 0,
      manualCorrection: capture ? capture.serialNumber !== capture.originalSerialNumber : false,
      imageBase64: capture?.imageBase64 ?? "",
      formValues
    });
    navigate("/save");
  }

  return (
    <main className="page split-page">
      <section className="summary-panel">
        <button className="back-button" onClick={() => navigate(operation?.captureMode === "none" ? "/operations" : "/capture")}>
          <ChevronLeft size={22} />
          Back
        </button>
        <h1>{operation?.name}</h1>
        <dl>
          <div>
            <dt>Material</dt>
            <dd>{material?.name}</dd>
          </div>
          <div>
            <dt>Part</dt>
            <dd>{part?.name}</dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>{operatorId}</dd>
          </div>
          {capture?.serialNumber && (
            <div>
              <dt>MF Number</dt>
              <dd>{capture.serialNumber}</dd>
            </div>
          )}
          <div>
            <dt>Date/time</dt>
            <dd>{new Date().toLocaleString()}</dd>
          </div>
        </dl>
        {capture?.previewUrl && <img className="captured-image" src={capture.previewUrl} alt="Confirmed serial" />}
      </section>

      <section className="form-panel">
        <h2>Operation Details</h2>
        <form className="stack" onSubmit={handleSubmit}>
          {fields.map(([fieldId, field]) => (
            <FieldRenderer
              key={fieldId}
              id={fieldId}
              field={field}
              value={formValues[fieldId] ?? ""}
              onChange={(value) => setFormValues((current) => ({ ...current, [fieldId]: value }))}
            />
          ))}
          {error && <div className="error-message">{error}</div>}
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate(operation?.captureMode === "none" ? "/operations" : "/capture")}
            >
              Back
            </button>
            <button className="primary-button">Review and save</button>
          </div>
        </form>
      </section>
    </main>
  );
}
