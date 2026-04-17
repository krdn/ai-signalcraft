/**
 * 이미지 OCR 통합 (DC 갤러리 등 이미지 중심 커뮤니티)
 *
 * 실제 OCR 엔진은 외부 API(Google Vision, Naver CLOVA OCR) 또는
 * 로컬 Tesseract가 필요. 여기서는 어댑터 패턴으로 구현:
 *
 * - Tesseract.js (Node.js 로컬, 무료, 한국어 80% 정확도)
 * - Google Vision API (유료, 95%+ 정확도, 빠름)
 * - Naver CLOVA OCR (한국어 최고 정확도)
 *
 * 활성화: OCR_ENGINE 환경변수 설정 시에만 수행.
 * 미설정 시 이미지 URL은 무시되고 텍스트만 분석.
 */

export interface OcrResult {
  text: string;
  confidence: number;
  engine: string;
}

export interface OcrAdapter {
  extract(imageUrl: string): Promise<OcrResult | null>;
  readonly engine: string;
}

/** No-op 어댑터: OCR 비활성 */
class NoOpOcrAdapter implements OcrAdapter {
  readonly engine = 'noop';
  async extract(): Promise<null> {
    return null;
  }
}

/** Tesseract.js 어댑터 */
class TesseractOcrAdapter implements OcrAdapter {
  readonly engine = 'tesseract';
  private worker: any = null;

  private async getWorker(): Promise<any> {
    if (this.worker) return this.worker;
    try {
      const tesseract = (await import('tesseract.js' as string)) as any;
      this.worker = await tesseract.createWorker('kor+eng');
      return this.worker;
    } catch {
      return null;
    }
  }

  async extract(imageUrl: string): Promise<OcrResult | null> {
    const worker = await this.getWorker();
    if (!worker) return null;
    try {
      const { data } = await worker.recognize(imageUrl);
      return {
        text: (data.text ?? '').trim(),
        confidence: data.confidence / 100,
        engine: 'tesseract',
      };
    } catch (error) {
      console.warn('[ocr] tesseract 실패:', error);
      return null;
    }
  }
}

/** Google Vision API 어댑터 (REST 호출) */
class GoogleVisionOcrAdapter implements OcrAdapter {
  readonly engine = 'google-vision';

  async extract(imageUrl: string): Promise<OcrResult | null> {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) return null;

    try {
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const annotation = data.responses?.[0]?.fullTextAnnotation;
      if (!annotation) return null;
      return {
        text: String(annotation.text ?? '').trim(),
        confidence: 0.95, // Google Vision은 신뢰도를 word 단위로만 제공
        engine: 'google-vision',
      };
    } catch (error) {
      console.warn('[ocr] google-vision 실패:', error);
      return null;
    }
  }
}

let cached: OcrAdapter | null = null;

export function getOcrAdapter(): OcrAdapter {
  if (cached) return cached;
  const engine = process.env.OCR_ENGINE?.toLowerCase();

  switch (engine) {
    case 'tesseract':
      cached = new TesseractOcrAdapter();
      break;
    case 'google-vision':
      cached = new GoogleVisionOcrAdapter();
      break;
    default:
      cached = new NoOpOcrAdapter();
  }
  return cached;
}

/**
 * 이미지 배열을 병렬 OCR (동시성 3 제한)
 */
export async function extractTextsFromImages(
  imageUrls: string[],
): Promise<Array<OcrResult | null>> {
  const adapter = getOcrAdapter();
  if (adapter.engine === 'noop') {
    return imageUrls.map(() => null);
  }

  const CONCURRENCY = 3;
  const results: Array<OcrResult | null> = new Array(imageUrls.length).fill(null);
  for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {
    const batch = imageUrls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((url) => adapter.extract(url)));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  return results;
}

/** OCR 결과를 기사/게시물 content에 병합 (text가 있으면 "[IMAGE OCR] " prefix로 추가) */
export function mergeOcrIntoContent(
  originalContent: string | null,
  ocrResults: Array<OcrResult | null>,
): string | null {
  const usable = ocrResults.filter(
    (r): r is OcrResult => r !== null && r.text.length > 5 && r.confidence >= 0.5,
  );
  if (usable.length === 0) return originalContent;

  const ocrText = usable.map((r) => `[IMAGE OCR] ${r.text}`).join('\n');
  return originalContent ? `${originalContent}\n\n${ocrText}` : ocrText;
}
