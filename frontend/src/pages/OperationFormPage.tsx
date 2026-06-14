import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { FieldRenderer } from "../components/FieldRenderer";

export function OperationFormPage() {
  const { config, operatorId, selectedOperationId, capture, setPendingRecord } = useAppContext();
  const operation = config.operations.find((item) => item.id === selectedOperationId);
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

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

    if (!capture || !operation) {
      setError("Capture or operation data is missing.");
      return;
    }

    setPendingRecord({
      operatorId,
      operation: operation.name,
      serialNumber: capture.serialNumber,
      dateTime: new Date().toISOString(),
      ocrConfidence: capture.confidence,
      manualCorrection: capture.serialNumber !== capture.originalSerialNumber,
      imageBase64: capture.imageBase64,
      formValues
    });
    navigate("/save");
  }

  return (
    <main className="page split-page">
      <section className="summary-panel">
        <h1>{operation?.name}</h1>
        <dl>
          <div>
            <dt>Operator</dt>
            <dd>{operatorId}</dd>
          </div>
          <div>
            <dt>Serial</dt>
            <dd>{capture?.serialNumber}</dd>
          </div>
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
            <button type="button" className="secondary-button" onClick={() => navigate("/capture")}>
              Back
            </button>
            <button className="primary-button">Review and save</button>
          </div>
        </form>
      </section>
    </main>
  );
}
