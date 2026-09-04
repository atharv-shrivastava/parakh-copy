export const OCR_CONTRACT_VERSION = "1.0";

export function normalizeOcrResponse(payload) {
  return {
    contractVersion: OCR_CONTRACT_VERSION,
    provider: payload?.provider ?? "unknown",
    detections: Array.isArray(payload?.detections)
      ? payload.detections.map((d) => ({
          text: String(d?.text ?? ""),
          confidence: typeof d?.confidence === "number" ? d.confidence : null,
          boundingBox: d?.boundingBox ?? null,
        }))
      : [],
  };
}
