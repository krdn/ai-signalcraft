'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold">예상치 못한 오류가 발생했습니다</h2>
        <p className="text-muted-foreground max-w-md">
          {error.message || '페이지를 불러오는 중 문제가 발생했습니다.'}
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        다시 시도
      </button>
    </div>
  );
}
