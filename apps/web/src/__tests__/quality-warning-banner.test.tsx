import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QualityWarningBanner } from '../components/report/quality-warning-banner';

describe('QualityWarningBanner', () => {
  it('metadata가 null이면 렌더링 안 함', () => {
    const { container } = render(<QualityWarningBanner metadata={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('qualityFlags 없으면 렌더링 안 함 (구버전 보고서)', () => {
    const { container } = render(<QualityWarningBanner metadata={{ keyword: 't' }} />);
    expect(container.firstChild).toBeNull();
  });

  it('qualityFlags 모두 false면 렌더링 안 함', () => {
    const { container } = render(
      <QualityWarningBanner
        metadata={{
          qualityFlags: {
            hasRateLimitFailures: false,
            hasPartialModules: false,
            samplingShallow: false,
          },
        }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('hasPartialModules true면 배너 표시', () => {
    render(
      <QualityWarningBanner
        metadata={{
          qualityFlags: {
            hasRateLimitFailures: true,
            hasPartialModules: true,
            samplingShallow: false,
          },
          modulesPartial: [
            { module: 'segmentation', reason: 'rate-limit', chunksTotal: null, chunksFailed: null },
          ],
        }}
      />,
    );
    expect(screen.getByText(/부분 실패했거나 표본이 얕습니다/)).toBeInTheDocument();
  });

  it('상세 보기 클릭 시 모듈 목록 표시', () => {
    render(
      <QualityWarningBanner
        metadata={{
          qualityFlags: {
            hasRateLimitFailures: true,
            hasPartialModules: true,
            samplingShallow: false,
          },
          modulesPartial: [
            { module: 'segmentation', reason: 'rate-limit', chunksTotal: null, chunksFailed: null },
            { module: 'macro-view', reason: 'rate-limit', chunksTotal: null, chunksFailed: null },
          ],
          warnings: [],
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '상세 보기' }));
    expect(screen.getByText(/segmentation/)).toBeInTheDocument();
    expect(screen.getByText(/macro-view/)).toBeInTheDocument();
  });

  it('samplingShallow true면 얕은 표본 섹션 표시', () => {
    render(
      <QualityWarningBanner
        metadata={{
          qualityFlags: {
            hasRateLimitFailures: false,
            hasPartialModules: false,
            samplingShallow: true,
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '상세 보기' }));
    expect(screen.getByText(/얕은 표본/)).toBeInTheDocument();
    expect(screen.getByText(/200건 미만/)).toBeInTheDocument();
  });
});
