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
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const width = el.scrollWidth;
      const height = el.scrollHeight;

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
