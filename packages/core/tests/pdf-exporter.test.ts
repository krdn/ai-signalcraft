// PDF 내보내기 브라우저 누수 회귀 테스트
// page.setContent/pdf 단계에서 예외가 나도 browser.close()가 보장되어야 한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToPdf } from '../src/report/pdf-exporter';

const { state } = vi.hoisted(() => ({
  state: { launched: 0, closed: 0, pdfShouldFail: false, closeShouldFail: false },
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => {
      state.launched++;
      return {
        newPage: async () => ({
          setContent: async () => {},
          pdf: async () => {
            if (state.pdfShouldFail) throw new Error('pdf fail (test)');
          },
        }),
        close: async () => {
          state.closed++;
          if (state.closeShouldFail) throw new Error('close fail (test)');
        },
      };
    }),
  },
}));

describe('exportToPdf 브라우저 정리', () => {
  beforeEach(() => {
    state.launched = 0;
    state.closed = 0;
    state.pdfShouldFail = false;
    state.closeShouldFail = false;
  });

  it('정상 완료 시 브라우저가 close된다', async () => {
    await exportToPdf('# 제목\n\n본문', '/tmp/pdf-exporter-test.pdf');
    expect(state.launched).toBe(1);
    expect(state.closed).toBe(1);
  });

  it('PDF 생성 실패 시에도 브라우저가 close된다 (누수 방지)', async () => {
    state.pdfShouldFail = true;
    await expect(exportToPdf('# 제목', '/tmp/pdf-exporter-test.pdf')).rejects.toThrow(
      'pdf fail (test)',
    );
    expect(state.launched).toBe(1);
    expect(state.closed).toBe(1);
  });

  it('close 실패가 원래 PDF 에러를 덮어쓰지 않는다', async () => {
    state.pdfShouldFail = true;
    state.closeShouldFail = true;
    await expect(exportToPdf('# 제목', '/tmp/pdf-exporter-test.pdf')).rejects.toThrow(
      'pdf fail (test)',
    );
    expect(state.closed).toBe(1);
  });
});
