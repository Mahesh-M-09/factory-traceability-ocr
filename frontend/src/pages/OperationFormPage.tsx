import { Camera, ChevronLeft, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { FieldRenderer } from "../components/FieldRenderer";
import { CameraCapture } from "../components/CameraCapture";
import { OperatorShell } from "../components/OperatorShell";
import { requestOcr } from "../services/api";
import { findDemoRecord, flagRecordForInvestigation, getOperationHistory, hasOperationSubmission, loadDemoRecords } from "../services/demoDatabaseService";
import { cleanSerialNumber } from "../services/serial";
import { findMaterial, findOperation, findPart } from "../services/selection";
import { recordOperationVisit } from "../services/sessionLogService";
import { getTodayKey, isSameLocalDay, loadProductionTargets } from "../services/targetService";
import type { AppConfig, FieldConfig } from "../types/config";

export function OperationFormPage() {
  const { config, operatorId, selectedMaterialId, selectedPartId, selectedOperationId, capture, setPendingRecord } =
    useAppContext();
  const material = findMaterial(config, selectedMaterialId);
  const part = findPart(config, selectedMaterialId, selectedPartId);
  const operation = findOperation(config, selectedMaterialId, selectedPartId, selectedOperationId);
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [showHingeCamera, setShowHingeCamera] = useState(false);
  const [hingeStatus, setHingeStatus] = useState("");
  const timerStartedAt = useRef(Date.now());
  const visitStartedAt = useRef(new Date().toISOString());
  const hingeUploadRef = useRef<HTMLInputElement | null>(null);

  const targetRecord = useMemo(() => {
    if (!capture?.serialNumber) {
      return null;
    }
    return findDemoRecord(capture.serialNumber);
  }, [capture?.serialNumber]);

  const fieldEntries = useMemo(() => {
    return operation?.requiredFields.map((fieldId) => [fieldId, config.fields[fieldId]] as const).filter(([, field]) => field) ?? [];
  }, [config.fields, operation]);

  const fields = useMemo(() => {
    const isReworkOperation = operation?.name.toLowerCase().includes("rework") ?? false;
    return fieldEntries
      .filter(([fieldId, field]) => (isReworkOperation && fieldId.startsWith("rework")) || isFieldVisible(field, formValues))
      .map(([fieldId, field]) => [fieldId, withDynamicFieldOptions(fieldId, field, targetRecord?.part ? findPartByName(config, targetRecord.part) : part)] as const);
  }, [config, fieldEntries, formValues, operation, part, targetRecord]);

  const stationStats = useMemo(() => {
    if (!material || !part || !operation) {
      return null;
    }
    const today = getTodayKey();
    const operationRows = getOperationHistory(loadDemoRecords()).filter(
      (row) => row.material === material.name && row.part === part.name && row.operation === operation.name && isSameLocalDay(row.timestamp, today)
    );
    const target =
      loadProductionTargets().find(
        (item) => item.date === today && item.material === material.name && item.part === part.name && item.operation === operation.name
      )?.targetQty ?? 0;
    const operatorDone = operationRows.filter((row) => row.operatorId === operatorId).length;
    return {
      completed: operationRows.length,
      target,
      pending: Math.max(target - operationRows.length, 0),
      operatorDone
    };
  }, [material, operation, operatorId, part]);

  const priorNotes = useMemo(() => {
    return (targetRecord?.events ?? [])
      .filter((event) => event.formValues.notes || event.formValues.reworkEntry)
      .slice(-4)
      .reverse();
  }, [targetRecord]);

  useEffect(() => {
    return () => {
      if (operatorId && material && part && operation) {
        recordOperationVisit({
          operatorId,
          material: material.name,
          part: part.name,
          operation: operation.name,
          enteredAt: visitStartedAt.current
        });
      }
    };
  }, [material, operation, operatorId, part]);

  useEffect(() => {
    setFormValues((current) => {
      const nextValues = { ...current };
      fieldEntries.forEach(([fieldId, field]) => {
        if ((nextValues[fieldId] === undefined || nextValues[fieldId] === "") && field.defaultValue) {
          nextValues[fieldId] = field.defaultValue;
        }
      });
      return nextValues;
    });
  }, [fieldEntries]);

  async function captureHingeSerial(blob: Blob) {
    setHingeStatus("Reading hinge serial...");
    try {
      const result = await requestOcr(blob);
      const cleaned = cleanSerialNumber(result.serialNumber ?? "", config.allowedCharacters);
      setFormValues((current) => ({ ...current, hingeSerial: cleaned }));
      setHingeStatus(`Hinge OCR confidence: ${result.confidence ? Math.round(result.confidence * 100) : 0}%`);
      setShowHingeCamera(false);
    } catch (hingeError) {
      setHingeStatus(hingeError instanceof Error ? hingeError.message : "Hinge OCR failed.");
    }
  }

  async function uploadHingeSerial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await captureHingeSerial(file);
    }
    event.target.value = "";
  }

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
      setError("Part not recognised. Raise to a team lead so they can add it with Investigation required.");
      return;
    }
    if (!isStamping && scannedSerial && hasOperationSubmission(scannedSerial, operation.name)) {
      flagRecordForInvestigation(scannedSerial, `Duplicate scan blocked for ${operation.name}`, operatorId);
      setError("This part was already submitted in this operation. Team lead review required; the record has been marked for investigation.");
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
      material: targetRecord?.material ?? material.name,
      part: targetRecord?.part ?? part.name,
      tableName: `${targetRecord?.material ?? material.name}_${targetRecord?.part ?? part.name}`.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, ""),
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
    <OperatorShell className="split-page">
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
            <dd>{targetRecord?.part ?? part?.name}</dd>
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
        {stationStats && (
          <div className="operation-progress-card">
            <span>Operation progress today</span>
            <strong>{stationStats.completed}/{stationStats.target || "-"}</strong>
            <small>{stationStats.pending} pending · you completed {stationStats.operatorDone}</small>
          </div>
        )}
        {targetRecord && (
          <div className="part-status-card">
            <span>Record found</span>
            <strong>{targetRecord.status}</strong>
            <small>{targetRecord.material} / {targetRecord.part}</small>
          </div>
        )}
        {priorNotes.length > 0 && (
          <div className="past-notes-card">
            <h2>Past notes</h2>
            {priorNotes.map((note) => (
              <p key={`${note.operation}-${note.dateTime}`}>{note.operation}: {note.formValues.reworkEntry || note.formValues.notes}</p>
            ))}
          </div>
        )}
        {capture?.previewUrl && <img className="captured-image" src={capture.previewUrl} alt="Confirmed serial" />}
      </section>

      <section className="form-panel">
        <h2>Operation Details</h2>
        <form className="stack" onSubmit={handleSubmit}>
          {fields.map(([fieldId, field]) => (
            <div className="operation-field-block" key={fieldId}>
              <FieldRenderer
                id={fieldId}
                field={field}
                value={formValues[fieldId] ?? ""}
                onChange={(value) => setFormValues((current) => ({ ...current, [fieldId]: value }))}
              />
              {fieldId === "hingeSerial" && (
                <div className="button-row">
                  <button type="button" className="secondary-button" onClick={() => setShowHingeCamera((current) => !current)}>
                    <Camera size={22} />
                    {showHingeCamera ? "Hide hinge camera" : "Scan hinge"}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => hingeUploadRef.current?.click()}>
                    <Upload size={22} />
                    Upload hinge image
                  </button>
                  <input ref={hingeUploadRef} className="hidden-input" type="file" accept="image/*" onChange={uploadHingeSerial} />
                </div>
              )}
            </div>
          ))}
          {showHingeCamera && <CameraCapture autoCaptureEnabled={false} onCapture={captureHingeSerial} />}
          {hingeStatus && <div className="status-message">{hingeStatus}</div>}
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
    </OperatorShell>
  );
}

function isFieldVisible(field: FieldConfig, formValues: Record<string, string>) {
  if (!field.visibleWhen) {
    return true;
  }
  return formValues[field.visibleWhen.fieldId] === field.visibleWhen.equals;
}

function withDynamicFieldOptions(fieldId: string, field: FieldConfig, part?: { mistakeReasons?: string[] } | null): FieldConfig {
  if (fieldId !== "reworkReason") {
    return field;
  }
  const reasons = part?.mistakeReasons?.length ? part.mistakeReasons : field.options ?? ["Other"];
  return { ...field, options: Array.from(new Set([...reasons, "Other"])) };
}

function findPartByName(config: AppConfig, partName: string) {
  return config.materials.flatMap((material) => material.parts).find((item) => item.name === partName);
}
