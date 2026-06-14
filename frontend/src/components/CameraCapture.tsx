import { Camera, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CameraCaptureProps {
  autoCaptureEnabled: boolean;
  onCapture: (blob: Blob) => void;
}

export function CameraCapture({ autoCaptureEnabled, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timeout: number | undefined;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
        if (autoCaptureEnabled) {
          timeout = window.setTimeout(() => captureFrame(), 2000);
        }
      } catch {
        setError("Camera access failed. Allow camera permission or enter the serial manually after retrying.");
      }
    }

    startCamera();

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [autoCaptureEnabled]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError("Camera is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture image. Please try again.");
          return;
        }
        onCapture(blob);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <section className="camera-panel">
      {error && <div className="error-message">{error}</div>}
      <video ref={videoRef} className="camera-preview" autoPlay playsInline muted />
      <div className="camera-actions">
        <button className="primary-button" onClick={captureFrame} disabled={!ready}>
          <Camera size={24} />
          Capture image
        </button>
        <button className="secondary-button" onClick={() => window.location.reload()}>
          <RefreshCw size={22} />
          Restart camera
        </button>
      </div>
    </section>
  );
}
