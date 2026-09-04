export async function analyzeWithCloudVision() {
  const error = new Error("Cloud Vision has been removed from PARAKH. Use the local PaddleOCR pipeline.");
  error.code = "VISION_REMOVED";
  error.statusCode = 410;
  throw error;
}
