import { CheckCircle2, ChevronLeft, RotateCcw, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { CameraCapture } from "../components/CameraCapture";
import { requestOcr } from "../services/api";
import { blobToBase64 } from "../services/image";
import { cleanSerialNumber } from "../services/serial";
import { findOperation, findPart } from "../services/selection";

export function CapturePage() {
  const { config, selectedMaterialId, selectedPartId, selectedOperationId, setCapture } = useAppContext();
  const part = findPart(config, selectedMaterialId, selectedPartId);
  const operation = findOperation(config, selectedMaterialId, selectedPartId, selectedOperationId);
  const [imagePreview, setImagePreview] = useState("");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [originalSerialNumber, setOriginalSerialNumber] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [rawText, setRawText] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const partPatterns = part?.serialPatterns ?? [];
  const serialIsValid = partPatterns.length ? partPatterns.some((pattern) => testPattern(pattern, serialNumber)) : Boolean(serialNumber);
  const serialExample = part?.serialExample ?? "configured serial rule";
  const manualCorrection = Boolean(originalSerialNumber && serialNumber !== originalSerialNumber);
  const needsReview = confidence < config.ocrConfidenceThreshold || !serialIsValid || manualCorrection;
  const confidenceLabel = confidence ? `${Math.round(confidence * 100)}%` : "Not read";

  async function handleCapture(blob: Blob) {
    setLoading(true);
    setError("");
    setImageBlob(blob);
    setImagePreview(URL.createObjectURL(blob));

    try {
      const [ocrResult, base64] = await Promise.all([requestOcr(blob), blobToBase64(blob)]);
      const cleaned = cleanSerialNumber(ocrResult.serialNumber ?? "", config.allowedCharacters);
      setImageBase64(base64);
      setSerialNumber(cleaned);
      setOriginalSerialNumber(cleaned);
      setConfidence(ocrResult.confidence ?? 0);
      setRawText(ocrResult.rawText ?? []);
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : "OCR failed.");
      setImageBase64(await blobToBase64(blob));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await handleCapture(file);
    }
    event.target.value = "";
  }

  function confirmCapture() {
    if (!serialNumber) {
      setError("Enter or scan a serial number before continuing.");
      return;
    }
    if (!serialIsValid) {
      setError(`Serial must match ${serialExample}.`);
      return;
    }

    setCapture({
      imageBlob,
      imageBase64,
      previewUrl: imagePreview,
      serialNumber,
      originalSerialNumber,
      confidence,
      rawText,
      needsReview,
      frameTypeId: part?.id ?? ""
    });
    navigate("/form");
  }

  return (
    <main className="page split-page">
      <section>
        <button className="back-button" onClick={() => navigate("/operations")}>
          <ChevronLeft size={22} />
          Back
        </button>
        <div className="page-heading">
          <h1>{operation?.name ?? "Capture"}</h1>
          <p>{part?.name}: capture, upload, or type the stamped serial number.</p>
        </div>
        <CameraCapture autoCaptureEnabled={config.autoCaptureEnabled} onCapture={handleCapture} />
        <button className="secondary-button upload-image-button" onClick={() => uploadRef.current?.click()}>
          <Upload size={22} />
          Upload image
        </button>
        <input ref={uploadRef} className="hidden-input" type="file" accept="image/*" onChange={handleUpload} />
      </section>

      <section className="review-panel">
        <h2>OCR Review</h2>
        {imagePreview && <img className="captured-image" src={imagePreview} alt="Captured frame serial" />}
        {loading && <div className="status-message">Reading serial number...</div>}
        {error && <div className="error-message">{error}</div>}
        {(serialNumber || rawText.length > 0 || confidence > 0) && (
          <div className="ocr-result-card">
            <div>
              <span>Detected serial</span>
              <strong>{serialNumber || "No serial selected"}</strong>
            </div>
            <div>
              <span>OCR confidence</span>
              <strong>{confidenceLabel}</strong>
            </div>
          </div>
        )}

        <label className="field">
          <span>Serial number</span>
          <input
            value={serialNumber}
            onChange={(event) => setSerialNumber(cleanSerialNumber(event.target.value, config.allowedCharacters))}
            autoComplete="off"
          />
        </label>

        <div className="review-meta">
          <span>Confidence: {confidenceLabel}</span>
          <span className={serialIsValid ? "valid-text" : "error-text"}>
            {serialIsValid ? "Format valid" : `Expected ${serialExample}`}
          </span>
          {needsReview && <span className="warning-text">Review required</span>}
        </div>

        {rawText.length > 0 && <p className="raw-text">Raw OCR: {rawText.join(" | ")}</p>}

        <div className="button-row">
          <button className="secondary-button" onClick={() => navigate("/operations")}>
            <RotateCcw size={22} />
            Operations
          </button>
          <button className="primary-button" onClick={confirmCapture} disabled={!serialNumber || loading}>
            <CheckCircle2 size={24} />
            Confirm serial
          </button>
        </div>
      </section>
    </main>
  );
}

function testPattern(pattern: string, value: string) {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}
