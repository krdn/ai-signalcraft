// PDF 내보내기 (Playwright 기반, D-05 / REPT-03)
import { chromium } from 'playwright';
import type { PdfExportOptions } from '../types/report';

export type { PdfExportOptions } from '../types/report';

/**
 * 마크다운 리포트를 Playwright로 HTML 렌더링 후 PDF로 내보내기
 */
export async function exportToPdf(
  markdownContent: string,
  outputPath: string,
  options: PdfExportOptions = {},
): Promise<void> {
  const html = buildHtmlFromMarkdown(markdownContent, options.title ?? '분석 리포트');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPath,
    format: options.format ?? 'A4',
    margin: options.margin ?? { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true,
  });
  await browser.close();
}

/**
 * 기본 마크다운 -> HTML 변환 (정규식 기반 + CSS 스타일링)
 * 외부 라이브러리 없이 간단한 변환 수행
 */
function buildHtmlFromMarkdown(markdown: string, title: string): string {
  let html = markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // li 태그를 ul로 감싸기
  html = html.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Noto Sans KR', sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #16213e; padding-bottom: 10px; }
    h2 { color: #16213e; margin-top: 30px; }
    h3 { color: #0f3460; }
    blockquote { border-left: 4px solid #e94560; padding-left: 15px; color: #666; background: #f9f9f9; margin: 15px 0; padding: 10px 15px; }
    ul { padding-left: 20px; }
    li { margin: 5px 0; }
    strong { color: #1a1a2e; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #16213e; color: white; }
  </style>
</head>
<body><p>${html}</p></body>
</html>`;
}
