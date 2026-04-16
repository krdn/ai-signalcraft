'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PdfExportButtonProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

const LAB_RE = /\b(?:oklab|oklch|lab|lch)\s*\(/i;

/**
 * dom-to-image-more adjustClonedNode 콜백.
 *
 * dom-to-image-more의 copyUserComputedStyleFast는:
 *   targetValue = targetStyle.getPropertyValue(name)
 *   if (targetValue) return;   ← 이미 값이 있으면 건너뜀
 *
 * 따라서 isAfterCopy=false (스타일 복사 전) 시점에 클론에 미리 값을 설정하면
 * copyUserComputedStyleFast가 해당 property를 건너뛰어 oklab 값이 복사되지 않는다.
 */
function adjustClonedNode(original: Element, clone: HTMLElement, isAfterCopy: boolean) {
  if (isAfterCopy || !(clone instanceof HTMLElement)) return;

  const cs = window.getComputedStyle(original);

  // box-shadow에 oklab/lab 포함 → 미리 none 설정 (복사 차단)
  if (LAB_RE.test(cs.getPropertyValue('box-shadow'))) {
    clone.style.setProperty('box-shadow', 'none');
  }

  // border-color에 oklab/lab 포함 → transparent로 사전 설정
  if (LAB_RE.test(cs.getPropertyValue('border-color'))) {
    clone.style.setProperty('border-color', 'transparent');
  }

  // outline-color에 oklab/lab 포함 → transparent로 사전 설정
  if (LAB_RE.test(cs.getPropertyValue('outline-color'))) {
    clone.style.setProperty('outline-color', 'transparent');
  }
}

export function PdfExportButton({
  targetRef,
  filename = 'report',
  variant = 'secondary',
  size = 'sm',
  className,
}: PdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const el = targetRef.current;
    if (!el) return;

    setIsExporting(true);
    try {
      const domToImage = (await import('dom-to-image-more')).default;
      const { jsPDF } = await import('jspdf');

      const scale = 2;
      const width = el.scrollWidth;
      const height = el.scrollHeight;

      const dataUrl = await (domToImage as unknown as {
        toPng(node: HTMLElement, options: Record<string, unknown>): Promise<string>;
      }).toPng(el, {
        width: width * scale,
        height: height * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${width}px`,
          height: `${height}px`,
        },
        bgcolor: '#ffffff',
        adjustClonedNode,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgRatio = height / width;
      const imgWidth = pdfWidth;
      const imgHeight = imgWidth * imgRatio;

      let yPosition = 0;
      while (yPosition < imgHeight) {
        if (yPosition > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, -yPosition, imgWidth, imgHeight);
        yPosition += pdfHeight;
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error('PDF 내보내기 실패:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
      className={className}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
      ) : (
        <FileDown className="h-4 w-4 mr-1.5" />
      )}
      {isExporting ? 'PDF 생성 중...' : 'PDF 저장'}
    </Button>
  );
}
