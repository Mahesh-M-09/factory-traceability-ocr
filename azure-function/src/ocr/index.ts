interface AzureReadBlock {
  text?: string;
  confidence?: number;
}

interface AzureReadLine {
  text?: string;
  words?: AzureReadBlock[];
}

interface AzureReadResult {
  readResult?: {
    blocks?: Array<{
      lines?: AzureReadLine[];
    }>;
  };
}

interface Candidate {
  text: string;
  confidence: number;
}

interface FunctionContext {
  log: {
    error: (error: unknown) => void;
  };
  res?: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

interface FunctionRequest {
  body?: unknown;
  rawBody?: unknown;
}

async function ocr(context: FunctionContext, request: FunctionRequest) {
  try {
    const image = getImageFromRequest(request);
    context.log.info(`OCR image bytes received: ${image.length}`);
    const visionResult = await callAzureVision(image);
    const candidates = extractCandidates(visionResult);
    const selected = selectBestCandidate(candidates);

    if (!selected) {
      context.res = json(422, {
        success: false,
        error: "OCR failed. Please retake image or enter serial manually."
      });
      return;
    }

    const threshold = Number(process.env.OCR_CONFIDENCE_THRESHOLD ?? "0.86");
    context.res = json(200, {
      success: true,
      serialNumber: selected.text,
      confidence: selected.confidence,
      rawText: candidates.map((candidate) => candidate.text),
      needsReview: selected.confidence < threshold
    });
  } catch (error) {
    context.log.error(error);
    const message = error instanceof Error ? error.message : "Unknown OCR backend error.";
    context.res = json(500, {
      success: false,
      error: `OCR failed: ${message}`
    });
  }
}

export = ocr;

function getImageFromRequest(request: FunctionRequest): Buffer {
  const body = request.body ?? request.rawBody;

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }

  if (typeof body === "string") {
    return Buffer.from(body, "binary");
  }

  throw new Error("Missing image request body.");
}

async function callAzureVision(image: Buffer): Promise<AzureReadResult> {
  const endpoint = process.env.AZURE_VISION_ENDPOINT;
  const key = process.env.AZURE_VISION_KEY;

  if (!endpoint || !key) {
    throw new Error("Azure Vision settings are missing.");
  }

  const response = await fetch(
    `${endpoint.replace(/\/$/, "")}/computervision/imageanalysis:analyze?features=read&api-version=2024-02-01`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Ocp-Apim-Subscription-Key": key
      },
      body: image
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Azure Vision returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  return (await response.json()) as AzureReadResult;
}

function extractCandidates(result: AzureReadResult): Candidate[] {
  const lines = result.readResult?.blocks?.flatMap((block) => block.lines ?? []) ?? [];
  return lines
    .map((line) => {
      const text = cleanSerial(line.text ?? "");
      const wordConfidences = line.words?.map((word) => word.confidence ?? 0).filter((confidence) => confidence > 0) ?? [];
      const confidence =
        wordConfidences.length > 0
          ? wordConfidences.reduce((total, current) => total + current, 0) / wordConfidences.length
          : 0;
      return { text, confidence };
    })
    .filter((candidate) => candidate.text.length > 0);
}

function selectBestCandidate(candidates: Candidate[]) {
  const serialPattern = new RegExp(process.env.OCR_SERIAL_PATTERN ?? "^[A-Z]{3}[0-9]{5}$");
  const matching = candidates.filter((candidate) => serialPattern.test(candidate.text));
  const pool = matching.length > 0 ? matching : candidates;

  return pool.sort((a, b) => b.confidence - a.confidence || b.text.length - a.text.length)[0];
}

function cleanSerial(value: string) {
  const allowedCharacters = process.env.OCR_ALLOWED_CHARACTERS ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const allowed = new Set(allowedCharacters.toUpperCase().split(""));
  return value
    .toUpperCase()
    .split("")
    .filter((character) => allowed.has(character))
    .join("");
}

function json(status: number, body: unknown) {
  return {
    status,
    body,
    headers: {
      "Content-Type": "application/json"
    }
  };
}
