import { CheckCircle2, ChevronLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import { CameraCapture } from "../components/CameraCapture";
import { requestOcr } from "../services/api";
import { blobToBase64 } from "../services/image";
import { cleanSerialNumber, getDefaultFrameType, isSerialValid } from "../services/serial";
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
  const [frameTypeId, setFrameTypeId] = useState(getDefaultFrameType(config).id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const frameType = config.frameTypes.find((item) => item.id === frameTypeId) ?? getDefaultFrameType(config);
  const serialIsValid = isSerialValid(serialNumber, frameType);
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

  function confirmCapture() {
    if (!imageBlob || !imageBase64) {
      setError("Capture an image before continuing.");
      return;
    }
    if (!serialIsValid) {
      setError(`Serial must match ${frameType.example}.`);
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
      frameTypeId
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
          <p>{part?.name}: capture the stamped serial number.</p>
        </div>
        <CameraCapture autoCaptureEnabled={config.autoCaptureEnabled} onCapture={handleCapture} />
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
          <span>Frame type</span>
          <select value={frameTypeId} onChange={(event) => setFrameTypeId(event.target.value)}>
            {config.frameTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

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
            {serialIsValid ? "Format valid" : `Expected ${frameType.example}`}
          </span>
          {needsReview && <span className="warning-text">Review required</span>}
        </div>

        {rawText.length > 0 && <p className="raw-text">Raw OCR: {rawText.join(" | ")}</p>}

        <div className="button-row">
          <button className="secondary-button" onClick={() => navigate("/operations")}>
            <RotateCcw size={22} />
            Operations
          </button>
          <button className="primary-button" onClick={confirmCapture} disabled={!imageBlob || loading}>
            <CheckCircle2 size={24} />
            Confirm serial
          </button>
        </div>
      </section>
    </main>
  );
}
