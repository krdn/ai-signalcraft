'use client';

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">세일즈 오류</h2>
      <p className="text-muted-foreground">
        {error.message || '세일즈 페이지를 불러올 수 없습니다.'}
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        다시 시도
      </button>
    </div>
  );
}
