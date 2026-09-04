function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function polygonToBox(vertices, imageWidth, imageHeight) {
  const points = Array.isArray(vertices) ? vertices : [];
  const xs = points.map((point) => Number(point?.x ?? 0)).filter(Number.isFinite);
  const ys = points.map((point) => Number(point?.y ?? 0)).filter(Number.isFinite);
  if (!xs.length || !ys.length || !imageWidth || !imageHeight) return null;
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  if (right <= left || bottom <= top) return null;
  return {
    left: clamp01(left / imageWidth),
    top: clamp01(top / imageHeight),
    width: clamp01((right - left) / imageWidth),
    height: clamp01((bottom - top) / imageHeight),
  };
}

function estimateLineHeight(words) {
  const heights = words.map((word) => {
    const box = word.boundingBox;
    return Number(box?.height || 0);
  }).filter((height) => height > 0);
  return heights.length ? heights.reduce((sum, value) => sum + value, 0) / heights.length : 18;
}

function wordsFromTextAnnotations(textAnnotations, imageIndex, imageWidth, imageHeight) {
  const words = (Array.isArray(textAnnotations) ? textAnnotations : []).slice(1).map((annotation, index) => ({
    index,
    text: String(annotation?.description || "").trim(),
    imageIndex,
    boundingBox: polygonToBox(annotation?.boundingPoly?.vertices, imageWidth, imageHeight),
    rawVertices: annotation?.boundingPoly?.vertices || [],
  })).filter((item) => item.text && item.boundingBox);

  if (!words.length) return [];
  const lineTolerance = Math.max(0.012, (estimateLineHeight(words) / Math.max(1, imageHeight)) * 0.75);
  const groups = [];
  for (const word of words) {
    const centerY = word.boundingBox.top + word.boundingBox.height / 2;
    let target = groups.find((group) => Math.abs(group.centerY - centerY) <= lineTolerance);
    if (!target) {
      target = { centerY, words: [] };
      groups.push(target);
    }
    target.words.push(word);
    target.centerY = target.words.reduce((sum, item) => sum + item.boundingBox.top + item.boundingBox.height / 2, 0) / target.words.length;
  }

  return groups.map((group, lineIndex) => {
    const sorted = group.words.sort((a, b) => a.boundingBox.left - b.boundingBox.left);
    const left = Math.min(...sorted.map((item) => item.boundingBox.left));
    const top = Math.min(...sorted.map((item) => item.boundingBox.top));
    const right = Math.max(...sorted.map((item) => item.boundingBox.left + item.boundingBox.width));
    const bottom = Math.max(...sorted.map((item) => item.boundingBox.top + item.boundingBox.height));
    return {
      id: `vision-${imageIndex}-${lineIndex}`,
      imageIndex,
      text: sorted.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim(),
      confidence: 0.95,
      boundingBox: { left, top, width: clamp01(right - left), height: clamp01(bottom - top) },
      source: "cloud-vision",
    };
  }).filter((item) => item.text);
}

export async function analyzeWithCloudVision(images, config) {
  if (!config.cloudVisionApiKey) {
    const error = new Error("Cloud Vision OCR is not configured. Add GOOGLE_CLOUD_VISION_API_KEY to the backend environment.");
    error.code = "VISION_NOT_CONFIGURED";
    throw error;
  }

  const requests = images.map(({ base64, mediaType }, imageIndex) => ({
    image: { content: base64 },
    features: [{ type: "TEXT_DETECTION" }],
    imageContext: { languageHints: ["en", "hi"] },
    _imageIndex: imageIndex,
    _mediaType: mediaType,
  }));

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(config.cloudVisionApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(config.visionTimeoutMs),
    body: JSON.stringify({ requests: requests.map(({ image, features, imageContext }) => ({ image, features, imageContext })) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Cloud Vision request failed (${response.status}).`);

  const evidence = [];
  const rawTexts = [];
  (data.responses || []).forEach((result, imageIndex) => {
    if (result?.error) return;
    const annotations = Array.isArray(result?.textAnnotations) ? result.textAnnotations : [];
    const fullText = annotations[0]?.description || result?.fullTextAnnotation?.text || "";
    if (fullText) rawTexts.push(`[IMAGE ${imageIndex + 1}] ${String(fullText).trim()}`);

    // Vision does not return the original raster dimensions in this response. Keep
    // coordinates pixel-relative until the caller supplies image dimensions, or use
    // the normalized boxes already supplied by OCR sources. For textAnnotations we
    // use normalized coordinates only when width/height metadata is present.
    const page = result?.fullTextAnnotation?.pages?.[0];
    const width = Number(page?.width || 0);
    const height = Number(page?.height || 0);
    if (width && height) evidence.push(...wordsFromTextAnnotations(annotations, imageIndex, width, height));
  });

  return { evidence, rawText: rawTexts.join("\n"), provider: "cloud-vision", model: "TEXT_DETECTION" };
}
