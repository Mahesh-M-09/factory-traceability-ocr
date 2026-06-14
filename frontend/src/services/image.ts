export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read captured image."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.split(",")[1] ?? result);
    };
    reader.readAsDataURL(blob);
  });
}
