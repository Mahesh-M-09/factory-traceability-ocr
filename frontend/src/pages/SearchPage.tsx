import { Camera, ChevronLeft, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CameraCapture } from "../components/CameraCapture";
import { requestOcr } from "../services/api";
import { findDemoRecord } from "../services/demoDatabaseService";
import { cleanSerialNumber } from "../services/serial";
import { useAppContext } from "../App";

export function SearchPage() {
  const { config } = useAppContext();
  const [serialNumber, setSerialNumber] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [status, setStatus] = useState("");
  const [searchedSerial, setSearchedSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const result = searchedSerial ? findDemoRecord(searchedSerial) : null;

  async function handleCapture(blob: Blob) {
    setLoading(true);
    setStatus("Reading serial with OCR...");
    try {
      const result = await requestOcr(blob);
      const cleaned = cleanSerialNumber(result.serialNumber ?? "", config.allowedCharacters);
      setSerialNumber(cleaned);
      setStatus(`OCR found ${cleaned || "no serial"}.`);
      setShowCamera(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "OCR failed.");
    } finally {
      setLoading(false);
    }
  }

  function searchSerial() {
    if (!serialNumber) {
      setStatus("Enter or scan a serial number first.");
      return;
    }
    setSearchedSerial(serialNumber);
    setStatus(findDemoRecord(serialNumber) ? "Record found in demo database." : "No local demo record found.");
  }

  return (
    <main className="page split-page">
      <section className="summary-panel">
        <button className="back-button" onClick={() => navigate("/materials")}>
          <ChevronLeft size={22} />
          Back
        </button>
        <div className="page-heading">
          <h1>Serial Search</h1>
          <p>Search a stamped serial manually or scan it with camera OCR.</p>
        </div>
        <div className="stack">
          <label className="field">
            <span>Serial number</span>
            <input
              value={serialNumber}
              onChange={(event) => setSerialNumber(cleanSerialNumber(event.target.value, config.allowedCharacters))}
              autoComplete="off"
            />
          </label>
          <div className="button-row">
            <button className="primary-button" onClick={searchSerial}>
              <Search size={22} />
              Search
            </button>
            <button className="secondary-button" onClick={() => setShowCamera((current) => !current)}>
              <Camera size={22} />
              {showCamera ? "Hide camera" : "Scan serial"}
            </button>
          </div>
          {status && <div className={loading ? "status-message" : "success-message"}>{status}</div>}
        </div>
      </section>
      <section className="review-panel">
        <h2>Lookup Result</h2>
        {result ? (
          <>
            <dl className="compact-summary">
              <div>
                <dt>MF Serial</dt>
                <dd>{result.serialNumber}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{result.status}</dd>
              </div>
              <div>
                <dt>Hinge link</dt>
                <dd>{result.linkedHingeSerial || "-"}</dd>
              </div>
              <div>
                <dt>Batch</dt>
                <dd>{result.batchNumber || "-"}</dd>
              </div>
            </dl>
            <div className="history-list">
              {result.events.map((event) => (
                <article key={event.id ?? `${event.operation}-${event.dateTime}`}>
                  <strong>{event.operation}</strong>
                  <span>{new Date(event.dateTime).toLocaleString()} / ID {event.operatorId}</span>
                  <p>
                    Jig {event.formValues.jigUsed || "-"} - Cycle {event.cycleTimeSeconds ? `${event.cycleTimeSeconds}s` : "-"}
                  </p>
                </article>
              ))}
            </div>
            {result.reworkLog.length > 0 && <p className="raw-text">Rework: {result.reworkLog.join(" | ")}</p>}
          </>
        ) : (
          <div className="empty-state">
            <h2>{searchedSerial || serialNumber || "No serial selected"}</h2>
            <p>Search a serial to show saved demo database history.</p>
          </div>
        )}
        {showCamera && <CameraCapture autoCaptureEnabled={false} onCapture={handleCapture} />}
      </section>
    </main>
  );
}
