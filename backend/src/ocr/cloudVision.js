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

function estimateLineHeight(words, imageHeight) {
  const heights = words.map((word) => Number(word?.pixelHeight || 0)).filter((height) => height > 0);
  return heights.length ? heights.reduce((sum, value) => sum + value, 0) / heights.length : Math.max(12, imageHeight * 0.02);
}

function wordsFromTextAnnotations(textAnnotations, imageIndex, imageWidth, imageHeight) {
  const words = (Array.isArray(textAnnotations) ? textAnnotations : []).slice(1).map((annotation, index) => {
    const vertices = annotation?.boundingPoly?.vertices || [];
    const boxPixels = polygonToPixelBox(vertices);
    return {
      index,
      text: String(annotation?.description || "").trim(),
      imageIndex,
      pixelBox: boxPixels,
      pixelHeight: boxPixels?.height || 0,
    };
  }).filter((item) => item.text && item.pixelBox);

  if (!words.length) return [];
  const lineTolerance = Math.max(10, estimateLineHeight(words, imageHeight) * 0.75);
  const groups = [];
  for (const word of words) {
    const centerY = word.pixelBox.top + word.pixelBox.height / 2;
    let target = groups.find((group) => Math.abs(group.centerY - centerY) <= lineTolerance);
    if (!target) {
      target = { centerY, words: [] };
      groups.push(target);
    }
    target.words.push(word);
    target.centerY = target.words.reduce((sum, item) => sum + item.pixelBox.top + item.pixelBox.height / 2, 0) / target.words.length;
  }

  return groups.map((group, lineIndex) => {
    const sorted = group.words.sort((a, b) => a.pixelBox.left - b.pixelBox.left);
    const left = Math.min(...sorted.map((item) => item.pixelBox.left));
    const top = Math.min(...sorted.map((item) => item.pixelBox.top));
    const right = Math.max(...sorted.map((item) => item.pixelBox.left + item.pixelBox.width));
    const bottom = Math.max(...sorted.map((item) => item.pixelBox.top + item.pixelBox.height));
    return {
      id: `vision-${imageIndex}-${lineIndex}`,
      imageIndex,
      text: sorted.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim(),
      confidence: 0.95,
      boundingBox: {
        left: clamp01(left / imageWidth),
        top: clamp01(top / imageHeight),
        width: clamp01((right - left) / imageWidth),
        height: clamp01((bottom - top) / imageHeight),
      },
      source: "cloud-vision",
    };
  }).filter((item) => item.text);
}

function polygonToPixelBox(vertices) {
  const points = Array.isArray(vertices) ? vertices : [];
  const xs = points.map((point) => Number(point?.x ?? 0)).filter(Number.isFinite);
  const ys = points.map((point) => Number(point?.y ?? 0)).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

export async function analyzeWithCloudVision(images, config) {
  if (!config.cloudVisionApiKey) {
    const error = new Error("Cloud Vision OCR is not configured. Add GOOGLE_CLOUD_VISION_API_KEY to the backend environment.");
    error.code = "VISION_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(config.cloudVisionApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(config.visionTimeoutMs),
    body: JSON.stringify({
      requests: images.map(({ base64, imageWidth, imageHeight }) => ({
        image: { content: base64 },
        features: [{ type: "TEXT_DETECTION" }],
        imageContext: { languageHints: ["en", "hi"] },
        _imageWidth: imageWidth,
        _imageHeight: imageHeight,
      })).map(({ _imageWidth, _imageHeight, ...request }) => ({ ...request, imageContext: { ...request.imageContext, _imageWidth, _imageHeight } })),
    }),
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
    const image = images[imageIndex] || {};
    const imageWidth = Number(image.imageWidth || result?.fullTextAnnotation?.pages?.[0]?.width || 0);
    const imageHeight = Number(image.imageHeight || result?.fullTextAnnotation?.pages?.[0]?.height || 0);
    if (imageWidth && imageHeight) evidence.push(...wordsFromTextAnnotations(annotations, imageIndex, imageWidth, imageHeight));
  });

  return { evidence, rawText: rawTexts.join("\n"), provider: "cloud-vision", model: "TEXT_DETECTION" };
}
