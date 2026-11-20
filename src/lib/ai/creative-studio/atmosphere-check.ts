import sharp from "sharp";
import { measureSubjectBox } from "./subject-crop";

export interface AtmosphereVerdict {
  original: { width: number; height: number };
  edited: { width: number; height: number };
  aspectDelta: number;
  skyMeanDelta: number;
  subjectMeanDelta: number;
  buildingSsim: number;
  edgeDelta: number;
  landmarkShift: number;
  accepted: boolean;
  reason: string;
}

const SAMPLE_W = 48;
const SAMPLE_H = 64;
const BOX_W = 32;
const BOX_H = 40;

/**
 * Compares a photograph with an atmosphere edit.
 * Color difference is one signal. The building box is also compared with SSIM,
 * an edge map, and the position of strong horizontal edges.
 * A sky change outside that box does not fail the building check.
 * A geometry change can fail even when the average color stays close.
 */
export async function compareAtmosphereEdit(original: Buffer, edited: Buffer): Promise<AtmosphereVerdict> {
  const [originalMeta, editedMeta] = await Promise.all([
    sharp(original).metadata(),
    sharp(edited).metadata(),
  ]);
  const originalSize = { width: originalMeta.width || 1, height: originalMeta.height || 1 };
  const editedSize = { width: editedMeta.width || 1, height: editedMeta.height || 1 };
  const aspectDelta = Math.abs(originalSize.width / originalSize.height - editedSize.width / editedSize.height);
  const [originalSample, editedSample, originalBox, editedBox] = await Promise.all([
    centerSample(original),
    centerSample(edited),
    buildingSample(original),
    buildingSample(edited),
  ]);
  const skyEnd = Math.floor(SAMPLE_H * 0.32);
  const subjectStart = Math.floor(SAMPLE_H * 0.4);
  const skyMeanDelta = meanDelta(originalSample, editedSample, 0, skyEnd);
  const subjectMeanDelta = meanDelta(originalSample, editedSample, subjectStart, SAMPLE_H);
  const buildingSsim = ssim(originalBox.luma, editedBox.luma);
  const edgeDelta = meanAbs(originalBox.edges, editedBox.edges);
  const landmarkShift = peakShift(originalBox.rowEnergy, editedBox.rowEnergy);

  let accepted = true;
  let reason = "Sky and light moved while the building stayed in place.";
  const landmarksMoved = landmarkShift > 0.12;
  const facadeRepainted = buildingSsim < 0.55;
  const edgesMoved = edgeDelta > 40 && landmarkShift > 0.06;
  const structureMoved = landmarksMoved || facadeRepainted || edgesMoved;
  if (structureMoved) {
    accepted = false;
    reason = `Building structure diverged. SSIM ${buildingSsim.toFixed(2)}, edge delta ${edgeDelta.toFixed(1)}, landmark shift ${landmarkShift.toFixed(2)}.`;
  } else if (subjectMeanDelta > 36) {
    accepted = false;
    reason = `Building area moved by ${subjectMeanDelta.toFixed(1)} levels, above the lock of 36.`;
  } else if (subjectMeanDelta > skyMeanDelta + 10 && subjectMeanDelta > 16) {
    accepted = false;
    reason = `Building area changed more than the sky (${subjectMeanDelta.toFixed(1)} vs ${skyMeanDelta.toFixed(1)}).`;
  } else if (skyMeanDelta < 3 && subjectMeanDelta < 3) {
    reason = "Edit matches the original closely.";
  }
  if (accepted && aspectDelta > 0.05) {
    reason = `${reason} The edited canvas aspect differs by ${aspectDelta.toFixed(3)}.`;
  }

  return {
    original: originalSize,
    edited: editedSize,
    aspectDelta: Number(aspectDelta.toFixed(3)),
    skyMeanDelta: Number(skyMeanDelta.toFixed(1)),
    subjectMeanDelta: Number(subjectMeanDelta.toFixed(1)),
    buildingSsim: Number(buildingSsim.toFixed(3)),
    edgeDelta: Number(edgeDelta.toFixed(1)),
    landmarkShift: Number(landmarkShift.toFixed(3)),
    accepted,
    reason,
  };
}

/** Compares the frame above a bottom information field, so that field is not read as a new facade. */
export async function compareAboveBottomField(original: Buffer, edited: Buffer, keep = 0.82): Promise<AtmosphereVerdict> {
  const [originalCrop, editedCrop] = await Promise.all([
    cropHeight(original, keep),
    cropHeight(edited, keep),
  ]);
  return compareAtmosphereEdit(originalCrop, editedCrop);
}

async function cropHeight(buffer: Buffer, keep: number): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1;
  const height = Math.max(1, Math.round((meta.height || 1) * keep));
  return sharp(buffer).extract({ left: 0, top: 0, width, height }).png().toBuffer();
}

async function buildingSample(buffer: Buffer): Promise<{ luma: Float64Array; edges: Float64Array; rowEnergy: number[] }> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  const box = await measureSubjectBox(buffer);
  const left = clamp(box.left, 0, width - 1);
  const top = clamp(box.top, 0, height - 1);
  const cropW = clamp(box.width, 1, width - left);
  const cropH = clamp(box.height, 1, height - top);
  const raw = await sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(BOX_W, BOX_H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const luma = new Float64Array(BOX_W * BOX_H);
  for (let i = 0; i < luma.length; i++) {
    luma[i] = 0.299 * raw[i * 3] + 0.587 * raw[i * 3 + 1] + 0.114 * raw[i * 3 + 2];
  }
  const edges = new Float64Array(luma.length);
  const rowEnergy = new Array<number>(BOX_H).fill(0);
  for (let y = 1; y < BOX_H - 1; y++) {
    for (let x = 1; x < BOX_W - 1; x++) {
      const index = y * BOX_W + x;
      const gx = Math.abs(luma[index + 1] - luma[index - 1]);
      const gy = Math.abs(luma[index + BOX_W] - luma[index - BOX_W]);
      edges[index] = gx + gy;
      rowEnergy[y] += gy;
    }
    rowEnergy[y] /= BOX_W;
  }
  return { luma, edges, rowEnergy };
}

async function centerSample(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  const targetAspect = 0.8;
  let cropWidth = width;
  let cropHeight = Math.round(width / targetAspect);
  if (cropHeight > height) {
    cropHeight = height;
    cropWidth = Math.max(1, Math.round(height * targetAspect));
  }
  const left = Math.max(0, Math.floor((width - cropWidth) / 2));
  const top = Math.max(0, Math.floor((height - cropHeight) / 2));
  return sharp(buffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(SAMPLE_W, SAMPLE_H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
}

function meanDelta(left: Buffer, right: Buffer, startRow: number, endRow: number): number {
  let total = 0;
  let count = 0;
  for (let y = startRow; y < endRow; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      const index = (y * SAMPLE_W + x) * 3;
      total += Math.abs(left[index] - right[index]);
      total += Math.abs(left[index + 1] - right[index + 1]);
      total += Math.abs(left[index + 2] - right[index + 2]);
      count += 3;
    }
  }
  return count === 0 ? 0 : total / count;
}

function meanAbs(left: Float64Array, right: Float64Array): number {
  let total = 0;
  for (let i = 0; i < left.length; i++) total += Math.abs(left[i] - right[i]);
  return left.length === 0 ? 0 : total / left.length;
}

function ssim(left: Float64Array, right: Float64Array): number {
  const count = left.length;
  let meanLeft = 0;
  let meanRight = 0;
  for (let i = 0; i < count; i++) {
    meanLeft += left[i];
    meanRight += right[i];
  }
  meanLeft /= count;
  meanRight /= count;
  let varianceLeft = 0;
  let varianceRight = 0;
  let covariance = 0;
  for (let i = 0; i < count; i++) {
    const deltaLeft = left[i] - meanLeft;
    const deltaRight = right[i] - meanRight;
    varianceLeft += deltaLeft * deltaLeft;
    varianceRight += deltaRight * deltaRight;
    covariance += deltaLeft * deltaRight;
  }
  varianceLeft /= count;
  varianceRight /= count;
  covariance /= count;
  const c1 = 6.5025;
  const c2 = 58.5225;
  const numerator = (2 * meanLeft * meanRight + c1) * (2 * covariance + c2);
  const denominator = (meanLeft * meanLeft + meanRight * meanRight + c1) * (varianceLeft + varianceRight + c2);
  return denominator === 0 ? 1 : numerator / denominator;
}

function peakShift(left: number[], right: number[]): number {
  const leftPeaks = peaks(left);
  const rightPeaks = peaks(right);
  const pairs = Math.min(leftPeaks.length, rightPeaks.length, 3);
  if (pairs === 0) return 0;
  let total = 0;
  for (let i = 0; i < pairs; i++) total += Math.abs(leftPeaks[i] - rightPeaks[i]);
  return total / pairs / left.length;
}

function peaks(energy: number[]): number[] {
  const mean = energy.reduce((sum, value) => sum + value, 0) / energy.length;
  const found: number[] = [];
  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] > mean && energy[i] >= energy[i - 1] && energy[i] >= energy[i + 1]) found.push(i);
  }
  return found.sort((a, b) => energy[b] - energy[a]).slice(0, 3).sort((a, b) => a - b);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
