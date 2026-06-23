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
  source: "line" | "combined";
}

interface FunctionContext {
  log: ((message: string) => void) & {
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

interface OcrRequestBody {
  imageBase64?: string;
  contentType?: string;
}

async function ocr(context: FunctionContext, request: FunctionRequest) {
  try {
    const image = getImageFromRequest(request);
    context.log(`OCR image bytes received: ${image.length}`);
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

  const parsedBody = parseJsonBody(body);
  if (parsedBody?.imageBase64) {
    return Buffer.from(parsedBody.imageBase64.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, ""), "base64");
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer as ArrayBuffer, body.byteOffset, body.byteLength);
  }

  if (typeof body === "string") {
    return Buffer.from(body, "base64");
  }

  throw new Error("Missing image request body.");
}

function parseJsonBody(body: unknown): OcrRequestBody | null {
  if (!body) {
    return null;
  }

  if (typeof body === "object" && !Buffer.isBuffer(body) && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) {
    return body as OcrRequestBody;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body) as OcrRequestBody;
    } catch {
      return null;
    }
  }

  return null;
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
      body: image as any
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
  const lineCandidates = lines
    .map((line) => createCandidate([line], "line"))
    .filter((candidate): candidate is Candidate => Boolean(candidate));

  const combinedCandidates: Candidate[] = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const adjacentCandidate = createCandidate([lines[index], lines[index + 1]], "combined");
    if (adjacentCandidate) {
      combinedCandidates.push(adjacentCandidate);
    }
  }

  if (lines.length > 1) {
    const allLinesCandidate = createCandidate(lines, "combined");
    if (allLinesCandidate) {
      combinedCandidates.push(allLinesCandidate);
    }
  }

  return dedupeCandidates([...lineCandidates, ...combinedCandidates]);
}

function selectBestCandidate(candidates: Candidate[]) {
  const serialPattern = new RegExp(process.env.OCR_SERIAL_PATTERN ?? "^[A-Z]{3}[0-9]{5}$");
  const matching = candidates.filter((candidate) => serialPattern.test(candidate.text));
  const pool = matching.length > 0 ? matching : candidates;

  return pool.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      scoreCandidateSource(b) - scoreCandidateSource(a) ||
      b.text.length - a.text.length
  )[0];
}

function createCandidate(lines: AzureReadLine[], source: Candidate["source"]): Candidate | null {
  const text = cleanSerial(lines.map((line) => line.text ?? "").join(""));
  const confidence = averageConfidence(
    lines.flatMap((line) => line.words?.map((word) => word.confidence ?? 0).filter((value) => value > 0) ?? [])
  );

  return text.length > 0 ? { text, confidence, source } : null;
}

function averageConfidence(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, current) => total + current, 0) / values.length;
}

function dedupeCandidates(candidates: Candidate[]) {
  const byText = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const existing = byText.get(candidate.text);
    if (!existing || candidate.confidence > existing.confidence) {
      byText.set(candidate.text, candidate);
    }
  }

  return Array.from(byText.values());
}

function scoreCandidateSource(candidate: Candidate) {
  return candidate.source === "combined" ? 1 : 0;
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
