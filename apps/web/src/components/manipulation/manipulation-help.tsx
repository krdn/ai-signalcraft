'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';

const SIGNALS = [
  {
    id: 'similarity',
    label: '텍스트 유사도',
    weight: 22,
    icon: '📝',
    summary: '짧은 시간 내 유사 문구가 다수 등장하는지 측정합니다.',
    detail:
      '5-gram Jaccard 유사도(0.6 이상) + 임베딩 코사인 유사도(0.92 이상)를 동시에 만족하는 댓글·기사를 클러스터로 묶습니다. 클러스터 크기, 작성자 다양성, 등장 속도(30분·2시간 기준)를 종합해 0–100점으로 환산합니다.',
  },
  {
    id: 'burst',
    label: '댓글 폭발',
    weight: 18,
    icon: '💥',
    summary: '특정 게시물에 댓글이 비정상적으로 집중적으로 몰리는지 탐지합니다.',
    detail:
      '5분 버킷으로 집계한 댓글 수를 게시물별 MAD(Median Absolute Deviation) 기반 z-score로 평가합니다. z-score ≥ 3인 버킷이 발견되면 증거로 표시되며, z ≥ 5이면 high 심각도로 분류합니다. 최소 30개 샘플에서 신뢰도 100%에 도달합니다.',
  },
  {
    id: 'media-sync',
    label: '미디어 동조',
    weight: 16,
    icon: '📰',
    summary: '복수의 언론사가 30분 이내에 거의 동일한 기사를 게재하는지 감지합니다.',
    detail:
      '코사인 유사도 0.88 이상인 기사 쌍을 찾아 같은 클러스터로 묶습니다. 참여 언론사가 2곳이면 기본 35점, 3곳 이상이면 65점에서 시작해 발행 속도(빠를수록 최대 +20점)를 가산합니다.',
  },
  {
    id: 'vote',
    label: '추천 이상',
    weight: 14,
    icon: '👍',
    summary: '길이 대비 추천 수가 통계적으로 비정상적인 게시물을 식별합니다.',
    detail:
      '게시물 길이-추천 수 관계를 OLS 회귀로 모델링합니다. IQR 이상치를 먼저 제거한 baseline으로 회귀선을 적합한 뒤, 이상치 후보의 잔차를 측정합니다(두 단계 robust 패턴). IQR 이상치 비율 ≥ 15%이면 high, ≥ 5%이면 medium 심각도로 분류합니다.',
  },
  {
    id: 'cross-platform',
    label: '크로스 플랫폼',
    weight: 12,
    icon: '🔗',
    summary: '동일 메시지가 여러 플랫폼에 동시에 퍼지는 캐스케이드 패턴을 포착합니다.',
    detail:
      '텍스트 유사도 신호에서 구성한 클러스터 중 출처 플랫폼이 2개 이상인 것만 분석합니다. 플랫폼 수 × 25점(최대 60점) + 전파 속도(15분 이내 +30점, 1시간 이내 +15점)로 점수를 산출합니다.',
  },
  {
    id: 'trend-shape',
    label: '트렌드 형태',
    weight: 10,
    icon: '📈',
    summary: '언급량이 자연 확산이 아닌 인공적 급등 후 평탄화되는 패턴인지 확인합니다.',
    detail:
      '피크 값 ÷ 피크 이전 중앙값(jumpRatio)과 피크 직후 5개 구간의 변동계수 역수(flatness)를 결합합니다. 변화점이 감지된 경우에만 flatness가 점수에 반영되며, 자연스러운 가우시안 곡선의 오탐을 방지합니다.',
  },
  {
    id: 'temporal',
    label: '시간대 이상',
    weight: 8,
    icon: '🕐',
    summary: '댓글 작성 시간대 분포가 과거 baseline과 크게 다를 경우 탐지합니다.',
    detail:
      '소스별 24시간 UTC 분포를 실측한 뒤 과거 baseline 분포와 KL 발산(Kullback-Leibler divergence)으로 비교합니다. KL ≥ 1.0이면 high, ≥ 0.5이면 medium으로 분류하며, 신뢰도는 샘플 수와 baseline 소스 매칭률의 곱으로 결정됩니다.',
  },
];

function SignalRow({ s }: { s: (typeof SIGNALS)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-0">
      <button
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mt-0.5 text-base">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{s.label}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              가중치 {s.weight}%
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.summary}</p>
        </div>
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 ml-8 text-xs text-muted-foreground leading-relaxed">
          {s.detail}
        </div>
      )}
    </div>
  );
}

export function ManipulationHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-4 mt-4 rounded-lg border bg-card">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm">조작 분석 원리</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? '닫기' : '7개 신호 · 점수 계산 방식'}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t">
          {/* 점수 계산 공식 */}
          <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">점수 계산 공식</p>
            <p>
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                조작 점수 = Σ(신호 점수 × 가중치) × 신뢰도 계수
              </code>
            </p>
            <p>
              신뢰도 계수는 7개 신호 각각의 신뢰도 평균입니다. 수집 데이터가 부족해 일부 신호를
              계산하지 못하면 신뢰도 계수가 낮아져 최종 점수도 비례해 낮아집니다. 점수 범위는
              0–100이며, <strong>50 이상이면 조작 의심</strong>으로 간주합니다.
            </p>
          </div>

          {/* 신호별 아코디언 */}
          <div>
            {SIGNALS.map((s) => (
              <SignalRow key={s.id} s={s} />
            ))}
          </div>

          {/* 주의사항 */}
          <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">해석 시 주의사항</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>신뢰도 계수가 0.5 미만이면 수집 데이터 부족으로 인한 저평가일 수 있습니다.</li>
              <li>
                단일 신호 점수가 높더라도 다른 신호가 0점이면 최종 점수는 낮게 나올 수 있습니다.
              </li>
              <li>
                점수는 상대적 지표입니다. 동일 구독의 시계열 추이와 함께 해석하는 것을 권장합니다.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
