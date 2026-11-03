/**
 * Client-Side Smart Auto-Transparent Logo Processor & Bounding Box Optimizer
 *
 * Automatically detects opaque solid/white background corners, strips uniform backgrounds
 * with smooth anti-aliased alpha ramping, and crops transparent padding so the logo mark
 * fills its designated safe slot crisply without looking tiny or clumsily boxed.
 */

export interface LogoProcessOptions {
  autoRemoveBg?: boolean;
  colorTolerance?: number; // default: 28
  featherRange?: number;   // default: 18
  maxDimension?: number;   // default: 800
}

export interface ProcessedLogoResult {
  dataUrl: string;
  width: number;
  height: number;
  isDarkLogo: boolean;
  hadOpaqueBg: boolean;
}

export async function processLogoImage(
  sourceUrl: string,
  options: LogoProcessOptions = {}
): Promise<ProcessedLogoResult> {
  const {
    autoRemoveBg = true,
    colorTolerance = 28,
    featherRange = 18,
    maxDimension = 800,
  } = options;

  return new Promise((resolve) => {
    const fallbackResult: ProcessedLogoResult = {
      dataUrl: sourceUrl,
      width: 150,
      height: 42,
      isDarkLogo: false,
      hadOpaqueBg: false,
    };

    if (typeof window === "undefined" || !sourceUrl) {
      resolve(fallbackResult);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const rawW = img.naturalWidth || img.width || 200;
        const rawH = img.naturalHeight || img.height || 80;
        const scale = Math.min(1, maxDimension / Math.max(rawW, rawH, 1));
        const w = Math.max(1, Math.round(rawW * scale));
        const h = Math.max(1, Math.round(rawH * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(fallbackResult);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 1. Sample 4 Corner Regions (3x3 average per corner)
        const sampleCorner = (startX: number, startY: number): [number, number, number, number] => {
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 3; dx++) {
              const cx = Math.min(w - 1, Math.max(0, startX + dx));
              const cy = Math.min(h - 1, Math.max(0, startY + dy));
              const idx = (cy * w + cx) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              a += data[idx + 3];
              count++;
            }
          }
          return [r / count, g / count, b / count, a / count];
        };

        const cTL = sampleCorner(0, 0);
        const cTR = sampleCorner(w - 3, 0);
        const cBL = sampleCorner(0, h - 3);
        const cBR = sampleCorner(w - 3, h - 3);

        const corners = [cTL, cTR, cBL, cBR];
        const opaqueCorners = corners.filter((c) => c[3] > 200).length;
        const hadOpaqueBg = opaqueCorners >= 3;

        // Check if corners are near-white or uniform background color
        const avgR = (cTL[0] + cTR[0] + cBL[0] + cBR[0]) / 4;
        const avgG = (cTL[1] + cTR[1] + cBL[1] + cBR[1]) / 4;
        const avgB = (cTL[2] + cTR[2] + cBL[2] + cBR[2]) / 4;
        const isNearWhite = avgR > 230 && avgG > 230 && avgB > 230;

        const maxCornerDiff = Math.max(
          ...corners.map((c) =>
            Math.sqrt((c[0] - avgR) ** 2 + (c[1] - avgG) ** 2 + (c[2] - avgB) ** 2)
          )
        );
        const isUniformBg = hadOpaqueBg && (isNearWhite || maxCornerDiff < 24);

        // 2. Perform Background Removal if Requested
        if (autoRemoveBg && isUniformBg) {
          const upperTol = colorTolerance + featherRange;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 10) continue;

            const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);

            if (dist < colorTolerance) {
              data[i + 3] = 0; // Fully transparent
            } else if (dist < upperTol) {
              const ramp = (dist - colorTolerance) / featherRange;
              data[i + 3] = Math.round(a * Math.max(0, Math.min(1, ramp)));
            }
          }

          ctx.putImageData(imgData, 0, 0);
        }

        // 3. Auto-Trim Transparent Margins
        const trimmedData = ctx.getImageData(0, 0, w, h).data;
        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let visibleCount = 0;
        let totalLum = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const a = trimmedData[idx + 3];
            if (a > 20) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;

              const lum = 0.299 * trimmedData[idx] + 0.587 * trimmedData[idx + 1] + 0.114 * trimmedData[idx + 2];
              totalLum += lum;
              visibleCount++;
            }
          }
        }

        const avgVisibleLum = visibleCount > 0 ? totalLum / visibleCount : 128;
        const isDarkLogo = avgVisibleLum < 140;

        if (visibleCount > 10 && maxX >= minX && maxY >= minY) {
          // Add 2px border pad
          const pad = 2;
          const cropX = Math.max(0, minX - pad);
          const cropY = Math.max(0, minY - pad);
          const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
          const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

          const outCanvas = document.createElement("canvas");
          outCanvas.width = cropW;
          outCanvas.height = cropH;
          const outCtx = outCanvas.getContext("2d");
          if (outCtx) {
            outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            resolve({
              dataUrl: outCanvas.toDataURL("image/png"),
              width: cropW,
              height: cropH,
              isDarkLogo,
              hadOpaqueBg,
            });
            return;
          }
        }

        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: w,
          height: h,
          isDarkLogo,
          hadOpaqueBg,
        });
      } catch (err) {
        console.warn("[LogoProcessor] Processing error, using original:", err);
        resolve(fallbackResult);
      }
    };

    img.onerror = () => {
      resolve(fallbackResult);
    };

    img.src = sourceUrl;
  });
}

