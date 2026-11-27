import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';

let wasmPrepared = false;

export function ensureBarcodeWasm(): void {
  if (wasmPrepared) return;
  wasmPrepared = true;
  prepareZXingModule({
    overrides: {
      locateFile: (file: string, prefix: string) => {
        if (file.endsWith('.wasm')) {
          return `${import.meta.env.BASE_URL}wasm/zxing_reader.wasm`;
        }
        return prefix + file;
      },
    },
  });
}

/**
 * GS1 Modulo-10 check-digit verification for EAN-8, UPC-A (12), EAN-13, and GTIN-14.
 * Non-GS1 codes (e.g. Code128 / QR) pass if >= 4 chars.
 */
export function isValidBarcodeText(raw: string): boolean {
  const code = raw.trim();
  if (!code) return false;
  if (!/^\d+$/.test(code)) return code.length >= 4;
  if (![8, 12, 13, 14].includes(code.length)) return code.length >= 6;

  const digits = code.split('').map(Number);
  const checkDigit = digits[digits.length - 1];
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 2; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === checkDigit;
}

const WASM_BASE_OPTIONS: ReaderOptions = {
  formats: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'Code128', 'QRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  binarizer: 'LocalAverage',
  maxNumberOfSymbols: 3,
};

export async function decodeImageDataMultiPass(
  imageData: ImageData,
  binarizer: 'LocalAverage' | 'GlobalHistogram' = 'LocalAverage'
): Promise<string | null> {
  ensureBarcodeWasm();
  try {
    const results = await readBarcodes(imageData, {
      ...WASM_BASE_OPTIONS,
      binarizer,
    });
    for (const r of results) {
      if (r.text && isValidBarcodeText(r.text)) {
        return r.text.trim();
      }
    }
  } catch {
    // Ignore decode errors on empty frames
  }
  return null;
}

export async function decodeWithNativeDetector(source: CanvasImageSource): Promise<string | null> {
  const NativeDetector = (
    window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
      };
    }
  ).BarcodeDetector;
  if (!NativeDetector) return null;
  try {
    const detector = new NativeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
    });
    const hits = await detector.detect(source);
    for (const hit of hits) {
      if (hit.rawValue && isValidBarcodeText(hit.rawValue)) {
        return hit.rawValue.trim();
      }
    }
  } catch {
    // Native detector failed or format unsupported
  }
  return null;
}

export async function decodeImageElementRobust(img: HTMLImageElement): Promise<string | null> {
  const canvas = document.createElement('canvas');
  const maxDim = 2200;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 1. Native hardware BarcodeDetector
  const nativeHit = await decodeWithNativeDetector(canvas);
  if (nativeHit) return nativeHit;

  // 2. ZXing-C++ WASM LocalAverage (handles rotated, inverted, curved labels)
  const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const wasmHit = await decodeImageDataMultiPass(fullData, 'LocalAverage');
  if (wasmHit) return wasmHit;

  // 3. High-contrast grayscale + GlobalHistogram fallback for dim/blurry photos
  ctx.filter = 'contrast(175%) grayscale(100%)';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  const contrastData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const contrastHit =
    (await decodeImageDataMultiPass(contrastData, 'GlobalHistogram')) ||
    (await decodeImageDataMultiPass(contrastData, 'LocalAverage'));
  if (contrastHit) return contrastHit;

  // 4. Inverted dark-packaging fallback (white bars on dark background)
  ctx.filter = 'invert(100%) grayscale(100%) contrast(170%)';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  const invertedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return await decodeImageDataMultiPass(invertedData, 'LocalAverage');
}
