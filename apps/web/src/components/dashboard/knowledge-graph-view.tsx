'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode } from '@ai-signalcraft/core/client';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// D3 시뮬레이션 호환 타입
interface SimNode extends GraphNode, d3.SimulationNodeDatum {
  metadata?: Record<string, unknown> | null;
}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
  type: string;
}

interface KnowledgeGraphViewProps {
  data: GraphData | null;
  isLoading?: boolean;
}

// 엔티티 타입별 색상
const TYPE_COLORS: Record<string, string> = {
  person: '#8b5cf6',
  organization: '#3b82f6',
  issue: '#ef4444',
  keyword: '#22c55e',
  frame: '#f59e0b',
  claim: '#06b6d4',
};

const TYPE_LABELS: Record<string, string> = {
  person: '인물',
  organization: '조직',
  issue: '이슈',
  keyword: '키워드',
  frame: '프레임',
  claim: '주장',
};

// 그룹별 클러스터 위치 (6분할 원형 배치)
const GROUP_POSITIONS: Record<string, { angle: number }> = {
  person: { angle: 270 }, // 상단
  issue: { angle: 330 }, // 우상단
  frame: { angle: 30 }, // 우하단
  claim: { angle: 90 }, // 하단
  keyword: { angle: 150 }, // 좌하단
  organization: { angle: 210 }, // 좌상단
};

// 텍스트 자르기 (긴 레이블 생략)
function truncateLabel(text: string, maxLen = 14): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

export function KnowledgeGraphView({ data, isLoading }: KnowledgeGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [, setHoveredNode] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(Object.keys(TYPE_COLORS)));

  // 필터링된 데이터
  const filteredData = useCallback(() => {
    if (!data) return { nodes: [], edges: [] };
    const nodeIds = new Set<string>();
    const nodes = data.nodes.filter((n) => {
      if (!activeTypes.has(n.group)) return false;
      nodeIds.add(n.id);
      return true;
    });
    const edges = data.edges.filter(
      (e) => nodeIds.has(e.source as string) && nodeIds.has(e.target as string),
    );
    return { nodes, edges };
  }, [data, activeTypes]);

  const render = useCallback(() => {
    if (!svgRef.current) return;
    const { nodes: fNodes, edges: fEdges } = filteredData();
    if (fNodes.length === 0) return;

    const width = 760;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;
    const clusterRadius = 170; // 클러스터 중심까지 거리

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 배경 클릭 시 선택 해제
    svg.on('click', () => setSelectedNode(null));

    const g = svg.append('g');

    // 줌
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // 엣지 색상
    function edgeColor(type: string): string {
      if (type === 'threatens') return '#ef4444';
      if (type === 'opposes') return '#f97316';
      if (type === 'causes') return '#a855f7';
      if (type === 'supports') return '#22c55e';
      return '#94a3b8';
    }

    // 노드 반경
    function nodeRadius(d: SimNode): number {
      return Math.max(d.size * 0.45, 7);
    }

    // 클러스터별 목표 좌표 계산
    function groupTarget(group: string): { x: number; y: number } {
      const pos = GROUP_POSITIONS[group] ?? { angle: 0 };
      const rad = (pos.angle * Math.PI) / 180;
      return {
        x: cx + clusterRadius * Math.cos(rad),
        y: cy + clusterRadius * Math.sin(rad),
      };
    }

    // Force 시뮬레이션
    const nodes: SimNode[] = fNodes.map((n) => {
      const { x, y } = groupTarget(n.group);
      return { ...n, x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60 };
    });
    const links: SimEdge[] = fEdges.map((e) => ({ ...e }));

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(links)
          .id((d) => d.id)
          .distance(70)
          .strength((d) => Math.max(d.weight * 0.5, 0.25)),
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force(
        'collision',
        d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 22),
      )
      // 그룹 클러스터링: 각 타입별 목표 위치로 당기기
      .force('x', d3.forceX<SimNode>((d) => groupTarget(d.group).x).strength(0.18))
      .force('y', d3.forceY<SimNode>((d) => groupTarget(d.group).y).strength(0.18));

    // 엣지
    const link = g
      .append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => edgeColor(d.type))
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', (d) => Math.max(d.weight * 3, 1))
      .attr('stroke-dasharray', (d) =>
        d.type === 'cooccurs' || d.type === 'related' ? '4,4' : 'none',
      );

    // 노드 그룹
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', function (event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function (event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as d3.DragBehavior<SVGGElement, SimNode, SimNode | d3.SubjectPosition>,
      );

    // 노드 원
    node
      .append('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => d.color ?? '#71717a')
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // 노드 레이블 (잘린 텍스트)
    node
      .append('text')
      .text((d) => truncateLabel(d.label))
      .attr('font-size', (d) => (d.group === 'keyword' ? 11 : 12))
      .attr('font-weight', (d) => (d.group === 'person' || d.group === 'issue' ? 700 : 500))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => nodeRadius(d) + 13)
      .attr('class', 'fill-foreground')
      .attr('paint-order', 'stroke')
      .attr('style', 'stroke: var(--color-card); stroke-width: 3px; stroke-linejoin: round;')
      .attr('pointer-events', 'none');

    // 툴팁 (전체 레이블 — title 태그)
    node.append('title').text((d) => d.label);

    // 연결된 노드 ID 집합 계산
    function getConnected(d: SimNode): Set<string> {
      const ids = new Set<string>([d.id]);
      links.forEach((l) => {
        const src = (l.source as SimNode).id;
        const tgt = (l.target as SimNode).id;
        if (src === d.id) ids.add(tgt);
        if (tgt === d.id) ids.add(src);
      });
      return ids;
    }

    // 호버 하이라이팅
    node
      .on('mouseenter', function (_event, d) {
        setHoveredNode(d.id);
        const connected = getConnected(d);

        node.attr('opacity', (n) => (connected.has(n.id) ? 1 : 0.15));
        link.attr('opacity', (l) => {
          const src = (l.source as SimNode).id;
          const tgt = (l.target as SimNode).id;
          return src === d.id || tgt === d.id ? 1 : 0.04;
        });
        link.attr('stroke-width', (l) => {
          const src = (l.source as SimNode).id;
          const tgt = (l.target as SimNode).id;
          return src === d.id || tgt === d.id
            ? Math.max(l.weight * 4, 2)
            : Math.max(l.weight * 3, 1);
        });
      })
      .on('mouseleave', function () {
        setHoveredNode(null);
        node.attr('opacity', 1);
        link.attr('opacity', 0.35);
        link.attr('stroke-width', (l) => Math.max(l.weight * 3, 1));
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // tick 핸들러
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // 초기 수렴 후 안정화
    simulation.alphaDecay(0.025);

    return () => {
      simulation.stop();
    };
  }, [filteredData]);

  useEffect(() => {
    const cleanup = render();
    return () => cleanup?.();
  }, [render]);

  // 엔티티 타입 필터 토글
  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className="min-h-[320px]">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.nodes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">지식 그래프</CardTitle>
          <CardHelp {...DASHBOARD_HELP.knowledgeGraph} />
        </div>
        {/* 엔티티 타입 필터 */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const exists = data.nodes.some((n) => n.group === key);
            if (!exists) return null;
            const count = data.nodes.filter((n) => n.group === key).length;
            return (
              <Badge
                key={key}
                variant={activeTypes.has(key) ? 'default' : 'outline'}
                className="cursor-pointer text-xs select-none"
                style={
                  activeTypes.has(key)
                    ? { backgroundColor: TYPE_COLORS[key], borderColor: TYPE_COLORS[key] }
                    : { borderColor: TYPE_COLORS[key], color: TYPE_COLORS[key] }
                }
                onClick={() => toggleType(key)}
              >
                {label} ({count})
              </Badge>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          노드 위에 마우스를 올리면 연결 관계가 강조됩니다 · 드래그로 위치 조정 가능
        </p>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full overflow-hidden rounded-lg border bg-card">
          <svg ref={svgRef} width={760} height={500} className="w-full" viewBox="0 0 760 500" />
        </div>

        {/* 노드 상세 패널 */}
        {selectedNode && (
          <div className="mt-3 rounded-lg border p-3 space-y-1.5 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold break-all">{selectedNode.label}</span>
              <Badge
                variant="secondary"
                className="text-xs shrink-0"
                style={{
                  backgroundColor: `${TYPE_COLORS[selectedNode.group] ?? '#71717a'}20`,
                  color: TYPE_COLORS[selectedNode.group] ?? '#71717a',
                }}
              >
                {TYPE_LABELS[selectedNode.group] ?? selectedNode.group}
              </Badge>
            </div>
            {selectedNode.metadata?.description ? (
              <p className="text-xs text-muted-foreground">
                {String(selectedNode.metadata.description)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              언급 횟수: {Math.round(selectedNode.size / 3)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
