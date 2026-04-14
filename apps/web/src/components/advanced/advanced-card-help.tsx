'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

// ─── 카드별 도움말 팝오버 ───

interface AdvancedCardHelpProps {
  title: string;
  description: string;
  details: readonly string[];
  howToRead: readonly string[];
  tips: readonly string[];
  limitations: readonly string[];
  /** 기술적 구현 원리 — 입력 데이터, 선행 의존성, 분석 알고리즘 등 */
  technicalDetails?: readonly string[];
  source: string;
}

export function AdvancedCardHelp({
  title,
  description,
  details,
  howToRead,
  tips,
  limitations,
  technicalDetails,
  source,
}: AdvancedCardHelpProps) {
  const [activeSection, setActiveSection] = useState<'info' | 'read' | 'tips' | 'tech'>('info');
  const hasTechDetails = technicalDetails && technicalDetails.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        className="rounded-full p-0.5 hover:bg-accent transition-colors"
        aria-label={`${title} 도움말`}
      >
        <Info className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-96 text-sm p-0" side="top" align="end">
        <div className="p-3 pb-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-muted-foreground text-xs leading-relaxed mt-1">{description}</p>
        </div>

        <div className="flex border-b px-3">
          <button
            type="button"
            onClick={() => setActiveSection('info')}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeSection === 'info'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            설명
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('read')}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeSection === 'read'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            읽는 법
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('tips')}
            className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeSection === 'tips'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            활용 팁
          </button>
          {hasTechDetails && (
            <button
              type="button"
              onClick={() => setActiveSection('tech')}
              className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                activeSection === 'tech'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              기술 정보
            </button>
          )}
        </div>

        <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
          {activeSection === 'info' && (
            <>
              <ul className="space-y-1">
                {details.map((detail, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-muted-foreground/60 shrink-0">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
              {limitations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">유의사항</p>
                    <ul className="space-y-0.5">
                      {limitations.map((item, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground/80 flex gap-1.5">
                          <span className="text-amber-500 shrink-0">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          )}

          {activeSection === 'read' && (
            <ul className="space-y-1.5">
              {howToRead.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <Badge
                    variant="outline"
                    className="shrink-0 h-4 w-4 justify-center p-0 text-[9px]"
                  >
                    {i + 1}
                  </Badge>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {activeSection === 'tips' && (
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-primary shrink-0">→</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}

          {activeSection === 'tech' && hasTechDetails && (
            <ul className="space-y-1.5">
              {technicalDetails.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-3 py-2">
          <p className="text-[10px] text-muted-foreground/60">분석 모듈: {source}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
