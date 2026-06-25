import { ChevronLeft, RotateCcw, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CameraCapture } from "../components/CameraCapture";
import { requestOcr } from "../services/api";

export function OcrTestPage() {
  const [previewUrl, setPreviewUrl] = useState("");
  const [serial, setSerial] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [rawText, setRawText] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  async function testImage(blob: Blob) {
    setLoading(true);
    setMessage("Reading image with Azure OCR...");
    setPreviewUrl(URL.createObjectURL(blob));
    try {
      const result = await requestOcr(blob);
      setSerial(result.serialNumber ?? "");
      setConfidence(result.confidence ?? 0);
      setRawText(result.rawText ?? []);
      setMessage(result.success ? "OCR test completed." : result.error ?? "OCR returned no result.");
    } catch (error) {
      setSerial("");
      setConfidence(0);
      setRawText([]);
      setMessage(error instanceof Error ? error.message : "OCR test failed.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await testImage(file);
    }
    event.target.value = "";
  }

  return (
    <main className="page split-page">
      <section>
        <button className="back-button" onClick={() => navigate("/admin")}>
          <ChevronLeft size={22} />
          Back
        </button>
        <div className="page-heading">
          <h1>OCR Test</h1>
          <p>Admin-only test bench for checking Azure OCR serial output and confidence before using a station.</p>
        </div>
        <CameraCapture autoCaptureEnabled={false} onCapture={testImage} />
        <div className="button-row">
          <button className="secondary-button" onClick={() => uploadRef.current?.click()}>
            <Upload size={22} />
            Upload image
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setPreviewUrl("");
              setSerial("");
              setConfidence(0);
              setRawText([]);
              setMessage("");
            }}
          >
            <RotateCcw size={22} />
            Clear
          </button>
        </div>
        <input ref={uploadRef} className="hidden-input" type="file" accept="image/*" onChange={uploadImage} />
      </section>
      <section className="review-panel ocr-test-result">
        <h2>OCR Result</h2>
        {previewUrl && <img className="captured-image" src={previewUrl} alt="OCR test preview" />}
        {message && <div className={loading ? "status-message" : serial ? "success-message" : "error-message"}>{message}</div>}
        <div className="ocr-result-card">
          <div>
            <span>Detected serial</span>
            <strong>{serial || "Not read"}</strong>
          </div>
          <div>
            <span>Confidence</span>
            <strong>{confidence ? `${Math.round(confidence * 100)}%` : "Not read"}</strong>
          </div>
        </div>
        {rawText.length > 0 && <p className="raw-text">Raw OCR: {rawText.join(" | ")}</p>}
      </section>
    </main>
  );
}
