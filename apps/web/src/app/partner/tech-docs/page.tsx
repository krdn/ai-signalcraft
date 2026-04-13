'use client';

import {
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  HardDrive,
  Play,
  Terminal,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface MethodCard {
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  description: string;
  steps: string[];
  timeInfo: {
    condition: string;
    time: string;
  }[];
  note?: string;
}

const METHODS: MethodCard[] = [
  {
    title: '방법 1: YouTube 자막(Transcript) 활용',
    icon: FileText,
    badge: '가장 빠름',
    badgeVariant: 'default',
    description:
      'YouTube 영상에 자막(자동 자막 포함)이 있는 경우, yt-dlp로 자막 파일을 직접 추출합니다. STT 변환이 필요 없어 수 초 내에 처리됩니다.',
    steps: [
      'yt-dlp --write-auto-sub --sub-lang ko --skip-download <URL>',
      '추출된 .vtt 또는 .srt 파일을 텍스트로 파싱',
      'Claude AI로 요약 처리',
    ],
    timeInfo: [
      { condition: '자막 있는 영상 (모든 길이)', time: '수 초 이내' },
      { condition: '한국어/영어 자동 자막', time: '즉시 처리 가능' },
    ],
    note: '자막이 없는 영상에는 방법 2를 사용하세요.',
  },
  {
    title: '방법 2: 오디오 → STT 변환 (Whisper)',
    icon: Cpu,
    badge: '높은 정확도',
    badgeVariant: 'secondary',
    description:
      'yt-dlp로 오디오를 추출한 후 OpenAI Whisper를 사용해 Speech-to-Text 변환합니다. 자막이 없는 영상에 적합합니다.',
    steps: [
      'yt-dlp -x --audio-format mp3 <URL>  # 오디오 추출',
      'whisper audio.mp3 --language ko      # STT 변환',
      '변환된 텍스트를 Claude AI로 요약',
    ],
    timeInfo: [
      { condition: '5분 영상 (CPU 환경)', time: '3~5분' },
      { condition: '30분 영상 (CPU 환경)', time: '20~30분' },
      { condition: '1시간 영상 (CPU 환경)', time: '40~60분' },
      { condition: '5분 영상 (GPU 환경)', time: '약 30초' },
      { condition: '30분 영상 (GPU 환경)', time: '3~5분' },
      { condition: '1시간 영상 (GPU 환경)', time: '6~10분' },
    ],
  },
  {
    title: '방법 3: 메타데이터 스크래핑',
    icon: HardDrive,
    badge: '즉시',
    badgeVariant: 'outline',
    description:
      'YouTube 페이지에서 제목, 설명, 챕터 정보 등 메타데이터를 추출합니다. 실제 영상 내용 분석은 불가하지만 개요 파악에 유용합니다.',
    steps: [
      'yt-dlp --dump-json <URL>  # 메타데이터 추출',
      '제목, 설명, 챕터, 태그 파싱',
      'Claude AI로 메타데이터 기반 요약',
    ],
    timeInfo: [{ condition: '모든 영상', time: '즉시 (수 초)' }],
    note: '영상 실제 발화 내용은 포함되지 않습니다.',
  },
];

const COMPARISON_TABLE = [
  {
    method: '자막 추출 (방법 1)',
    available: true,
    condition: '자막 있는 영상 한정',
    time: '수 초',
  },
  {
    method: 'STT 변환 (방법 2)',
    available: 'conditional',
    condition: 'whisper 설치 필요',
    time: '수 분~수십 분',
  },
  {
    method: '메타데이터 (방법 3)',
    available: true,
    condition: '제한적 내용',
    time: '즉시',
  },
  {
    method: 'URL 직접 요약',
    available: false,
    condition: '영상 직접 처리 불가',
    time: '-',
  },
];

export default function TechDocsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">기술자료</h1>
        </div>
        <p className="text-muted-foreground">
          AI SignalCraft 활용에 필요한 기술 정보를 제공합니다.
        </p>
      </div>

      {/* YouTube 요약 섹션 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-red-500" />
          <h2 className="text-xl font-semibold">YouTube 동영상 내용 요약</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          YouTube 동영상을 텍스트로 변환하여 AI 요약하는 3가지 방법과 소요 시간 안내입니다.
        </p>

        {/* 방법 카드 목록 */}
        <div className="space-y-4">
          {METHODS.map((method) => {
            const Icon = method.icon;
            return (
              <Card key={method.title}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <CardTitle className="text-base">{method.title}</CardTitle>
                    </div>
                    <Badge variant={method.badgeVariant} className="shrink-0">
                      {method.badge}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{method.description}</p>

                  {/* 명령어 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Terminal className="h-3.5 w-3.5" />
                      <span>실행 단계</span>
                    </div>
                    <div className="rounded-md bg-muted/60 p-3 space-y-1.5">
                      {method.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                          <code className="font-mono text-foreground/80 break-all">{step}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 소요 시간 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>예상 소요 시간</span>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {method.timeInfo.map((info, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs"
                        >
                          <span className="text-muted-foreground">{info.condition}</span>
                          <span className="font-semibold text-primary ml-2 shrink-0">
                            {info.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {method.note && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                      ⚠️ {method.note}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Separator />

        {/* 방법 비교표 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Play className="h-4 w-4 text-primary" />
            <span>방법 비교 요약</span>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">방법</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    가용 여부
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                    조건
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    소요 시간
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {COMPARISON_TABLE.map((row) => (
                  <tr key={row.method} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{row.method}</td>
                    <td className="px-4 py-2.5">
                      {row.available === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : row.available === false ? (
                        <span className="text-muted-foreground">✕</span>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          조건부
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">
                      {row.condition}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
