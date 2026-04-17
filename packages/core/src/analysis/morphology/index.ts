/**
 * 한국어 형태소 분석 인터페이스
 *
 * 실제 Mecab/Komoran/khaiii 바인딩은 네이티브 의존성이 필요.
 * 여기서는 어댑터 패턴으로 구현: 환경변수나 런타임 감지로 사용 가능한 엔진을 선택,
 * 없으면 경량 fallback(조사 분리 룰 기반)으로 대체.
 *
 * 사용 예시:
 *   const tokens = await analyzeMorphemes("한동훈이 발언했다");
 *   // [{ word: "한동훈", tag: "NNP" }, { word: "이", tag: "JKS" }, ...]
 */

export interface Morpheme {
  /** 형태소 표면형 */
  word: string;
  /** 품사 태그 (세종 태그셋 호환) */
  tag: string;
}

export interface MorphologyAdapter {
  analyze(text: string): Promise<Morpheme[]>;
  readonly engine: string;
}

/**
 * 경량 fallback 분석기
 * 본격 형태소 분석기 없이도 "조사 분리" 수준의 정규화 제공
 *
 * 한국어 조사 목록 (고빈도):
 *   주격: 이/가, 은/는, 께서
 *   목적격: 을/를
 *   소유격: 의
 *   부사격: 에, 에서, 에게, 한테, 로/으로, 와/과
 *   보조사: 도, 만, 부터, 까지
 */
const JOSA_PATTERN =
  /(이|가|은|는|을|를|의|에|에서|에게|한테|에게서|로|으로|와|과|도|만|부터|까지|라고|이라고|께서|께|이나|나)$/;

class FallbackMorphologyAdapter implements MorphologyAdapter {
  readonly engine = 'fallback';

  async analyze(text: string): Promise<Morpheme[]> {
    const morphemes: Morpheme[] = [];
    // 공백 기준 어절 분리 후 각 어절에서 조사 제거
    const eojeols = text.split(/\s+/).filter(Boolean);
    for (const word of eojeols) {
      const match = word.match(JOSA_PATTERN);
      if (match && word.length > match[0].length) {
        const stem = word.slice(0, word.length - match[0].length);
        morphemes.push({ word: stem, tag: 'NNG' }); // 일반명사로 태그 (정확하지 않음)
        morphemes.push({ word: match[0], tag: 'JOSA' });
      } else {
        morphemes.push({ word, tag: 'NNG' });
      }
    }
    return morphemes;
  }
}

let cached: MorphologyAdapter | null = null;

/**
 * 런타임 감지로 최적의 어댑터 선택
 * 환경변수 MORPHOLOGY_ENGINE 으로 강제 가능 (mecab / komoran / fallback)
 */
export async function getMorphologyAdapter(): Promise<MorphologyAdapter> {
  if (cached) return cached;

  const forced = process.env.MORPHOLOGY_ENGINE?.toLowerCase();

  if (!forced || forced === 'mecab') {
    try {
      // mecab-ya는 optional dependency
      const mecabMod = (await import('mecab-ya' as string)) as any;
      cached = {
        engine: 'mecab',
        async analyze(text: string) {
          return await new Promise<Morpheme[]>((resolve, reject) => {
            mecabMod.pos(text, (err: Error | null, result: Array<[string, string]>) => {
              if (err) return reject(err);
              resolve(result.map(([word, tag]) => ({ word, tag })));
            });
          });
        },
      };
      return cached;
    } catch {
      if (forced === 'mecab') {
        console.warn('[morphology] mecab 요청됐으나 설치되지 않음, fallback 사용');
      }
    }
  }

  cached = new FallbackMorphologyAdapter();
  return cached;
}

/**
 * 텍스트 분석 (adapter 자동 선택)
 */
export async function analyzeMorphemes(text: string): Promise<Morpheme[]> {
  const adapter = await getMorphologyAdapter();
  return adapter.analyze(text);
}

/**
 * 명사만 추출 (개체명 매칭에 유용)
 * fallback 모드에서는 NNG 태그된 토큰 전부 반환
 */
export async function extractNouns(text: string): Promise<string[]> {
  const morphs = await analyzeMorphemes(text);
  return morphs
    .filter((m) => m.tag.startsWith('NN') || m.tag === 'NNP' || m.tag === 'NNG')
    .map((m) => m.word)
    .filter((w) => w.length >= 2);
}

/**
 * 조사를 제거한 텍스트 반환 (개체명 매칭 정확도 향상)
 * 예: "한동훈이 발언했다" → "한동훈 발언했다"
 */
export async function stripJosa(text: string): Promise<string> {
  const morphs = await analyzeMorphemes(text);
  return morphs
    .filter((m) => m.tag !== 'JOSA' && !m.tag.startsWith('J'))
    .map((m) => m.word)
    .join(' ');
}
