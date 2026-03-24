import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI SignalCraft',
  description: '여론 분석 대시보드',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
