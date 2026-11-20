import sharp from "sharp";

export interface SubjectBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 0–1. Low when the base of the building could not be separated from the foreground. */
  confidence: number;
}

export interface CropPlan {
  strategy: "crop" | "contain";
  left: number;
  top: number;
  width: number;
  height: number;
  containsSubject: boolean;
  reason: string;
}

const SAMPLE_W = 64;
const SAMPLE_H = 80;

/**
 * Bounds the building from the roofline downward.
 * Open sky is excluded. The entrance stays inside the box.
 * Side walkways stay inside when they cannot be separated from the facade.
 */
export async function measureSubjectBox(buffer: Buffer): Promise<SubjectBox> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  const raw = await sharp(buffer)
    .resize(SAMPLE_W, SAMPLE_H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const lum = (x: number, y: number) => {
    const index = (y * SAMPLE_W + x) * 3;
    return 0.299 * raw[index] + 0.587 * raw[index + 1] + 0.114 * raw[index + 2];
  };
  const skyPixel = (x: number, y: number) => {
    const index = (y * SAMPLE_W + x) * 3;
    const r = raw[index];
    const g = raw[index + 1];
    const b = raw[index + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const blueSky = b > r + 15 && b + 10 > g && luminance > 80;
    return luminance > 150 || blueSky;
  };
  const edgeAt = (y: number) => {
    let total = 0;
    for (let x = 1; x < SAMPLE_W; x++) total += Math.abs(lum(x, y) - lum(x - 1, y));
    return total / (SAMPLE_W - 1);
  };
  let skyRows = 0;
  for (let y = 0; y < SAMPLE_H; y++) {
    let bright = 0;
    for (let x = 0; x < SAMPLE_W; x++) if (skyPixel(x, y)) bright += 1;
    if (bright / SAMPLE_W > 0.62 && edgeAt(y) < 12) skyRows += 1;
    else break;
  }
  const roofRow = Math.min(SAMPLE_H - 2, skyRows);
  let baseRow = SAMPLE_H - 1;
  let foundBase = false;
  const earliestBase = roofRow + Math.floor((SAMPLE_H - roofRow) * 0.55);
  for (let y = SAMPLE_H - 1; y > earliestBase; y--) {
    if (edgeAt(y) >= 14) {
      baseRow = y;
      foundBase = true;
      break;
    }
  }
  let leftCol = 0;
  let rightCol = SAMPLE_W - 1;
  for (let x = 0; x < SAMPLE_W; x++) {
    let skyLike = 0;
    const span = Math.max(1, baseRow - roofRow);
    for (let y = roofRow; y <= baseRow; y++) if (lum(x, y) > 168 && edgeAt(y) < 8) skyLike += 1;
    if (skyLike / span < 0.75) {
      leftCol = x;
      break;
    }
  }
  for (let x = SAMPLE_W - 1; x >= leftCol; x--) {
    let skyLike = 0;
    const span = Math.max(1, baseRow - roofRow);
    for (let y = roofRow; y <= baseRow; y++) if (lum(x, y) > 168 && edgeAt(y) < 8) skyLike += 1;
    if (skyLike / span < 0.75) {
      rightCol = x;
      break;
    }
  }
  const padX = Math.round(SAMPLE_W * 0.02);
  const padY = Math.round(SAMPLE_H * 0.02);
  const sampleLeft = Math.max(0, leftCol - padX);
  const sampleRight = Math.min(SAMPLE_W - 1, rightCol + padX);
  const sampleTop = Math.max(0, roofRow - padY);
  const sampleBottom = Math.min(SAMPLE_H - 1, baseRow + padY);
  return {
    left: Math.round((sampleLeft / SAMPLE_W) * width),
    top: Math.round((sampleTop / SAMPLE_H) * height),
    width: Math.max(1, Math.round(((sampleRight - sampleLeft + 1) / SAMPLE_W) * width)),
    height: Math.max(1, Math.round(((sampleBottom - sampleTop + 1) / SAMPLE_H) * height)),
    confidence: foundBase ? 0.75 : 0.4,
  };
}

/**
 * A crop is used only when a target-shaped window can hold the whole subject.
 * Otherwise the photograph is contained and the building is not sliced.
 */
export function planSubjectCrop(input: {
  imageWidth: number;
  imageHeight: number;
  subject: Pick<SubjectBox, "left" | "top" | "width" | "height">;
  targetWidth: number;
  targetHeight: number;
  align?: "safe" | "end";
}): CropPlan {
  const targetAspect = input.targetWidth / input.targetHeight;
  const boxRight = input.subject.left + input.subject.width;
  const boxBottom = input.subject.top + input.subject.height;
  let cropW = input.imageWidth;
  let cropH = Math.round(cropW / targetAspect);
  if (cropH > input.imageHeight) {
    cropH = input.imageHeight;
    cropW = Math.round(cropH * targetAspect);
  }
  const fits = input.subject.width <= cropW && input.subject.height <= cropH && cropW <= input.imageWidth && cropH <= input.imageHeight;
  if (!fits) {
    return {
      strategy: "contain",
      left: 0,
      top: 0,
      width: input.imageWidth,
      height: input.imageHeight,
      containsSubject: true,
      reason: "The building is taller than a safe crop for this frame, so the full photograph is kept.",
    };
  }
  let left = input.subject.left - Math.floor((cropW - input.subject.width) / 2);
  left = clamp(left, 0, input.imageWidth - cropW);
  const slackAbove = input.subject.top;
  const slackBelow = input.imageHeight - boxBottom;
  let top = input.subject.top - Math.min(slackAbove, Math.round((cropH - input.subject.height) * 0.7));
  if (input.align === "end") {
    const endTop = input.imageHeight - cropH;
    if (endTop <= input.subject.top && endTop + cropH >= boxBottom) top = endTop;
  }
  top = clamp(top, 0, input.imageHeight - cropH);
  if (top > input.subject.top || top + cropH < boxBottom) {
    top = clamp(input.subject.top, 0, input.imageHeight - cropH);
  }
  const contains = left <= input.subject.left && top <= input.subject.top && left + cropW >= boxRight && top + cropH >= boxBottom;
  if (!contains) {
    return {
      strategy: "contain",
      left: 0,
      top: 0,
      width: input.imageWidth,
      height: input.imageHeight,
      containsSubject: true,
      reason: "No window keeps the roof and the entrance inside the frame.",
    };
  }
  return {
    strategy: "crop",
    left,
    top,
    width: cropW,
    height: cropH,
    containsSubject: true,
    reason: "Crop keeps the building and fills the advertising frame.",
  };
}

export async function fitSubjectPhoto(
  buffer: Buffer,
  targetWidth: number,
  targetHeight: number,
  align: "safe" | "end" = "safe"
): Promise<{
  buffer: Buffer;
  plan: CropPlan;
  subject: SubjectBox;
}> {
  const meta = await sharp(buffer).metadata();
  const subject = await measureSubjectBox(buffer);
  const plan = planSubjectCrop({
    imageWidth: meta.width || 1,
    imageHeight: meta.height || 1,
    subject,
    targetWidth,
    targetHeight,
    align,
  });
  if (plan.strategy === "contain") {
    const contained = await sharp(buffer)
      .resize(targetWidth, targetHeight, {
        fit: "contain",
        background: { r: 247, g: 243, b: 236 },
      })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { buffer: contained, plan, subject };
  }
  const cropped = await sharp(buffer)
    .extract({ left: plan.left, top: plan.top, width: plan.width, height: plan.height })
    .resize(targetWidth, targetHeight, { fit: "fill" })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { buffer: cropped, plan, subject };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
