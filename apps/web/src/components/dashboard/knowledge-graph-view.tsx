'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode } from '@ai-signalcraft/core/client';
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

export function KnowledgeGraphView({ data, isLoading }: KnowledgeGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
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

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 700;
    const height = 450;
    const g = svg.append('g');

    // 줌
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // 범례
    const legend = g.append('g').attr('transform', 'translate(10, 10)');
    const activeEntries = Object.entries(TYPE_LABELS).filter(([key]) => activeTypes.has(key));

    activeEntries.forEach(([key, label], i) => {
      legend
        .append('circle')
        .attr('cx', 6)
        .attr('cy', i * 18)
        .attr('r', 5)
        .attr('fill', TYPE_COLORS[key]);
      legend
        .append('text')
        .attr('x', 16)
        .attr('y', i * 18 + 4)
        .text(label)
        .attr('font-size', 10)
        .attr('fill', '#a1a1aa');
    });

    // Force 시뮬레이션
    const nodes: SimNode[] = fNodes.map((n) => ({ ...n }));
    const links: SimEdge[] = fEdges.map((e) => ({ ...e }));

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(links)
          .id((d) => d.id)
          .distance(100)
          .strength((d) => d.weight * 0.6),
      )
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // 엣지
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        if (d.type === 'threatens') return '#ef4444';
        if (d.type === 'opposes') return '#f97316';
        if (d.type === 'causes') return '#a855f7';
        return '#4a4a4a';
      })
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', (d) => Math.max(d.weight * 4, 1.5))
      .attr('stroke-dasharray', (d) =>
        d.type === 'cooccurs' || d.type === 'related' ? '4,4' : 'none',
      );

    // 엣지 라벨
    const edgeLabels: Record<string, string> = {
      threatens: '위협',
      opposes: '대립',
      causes: '연쇄',
      supports: '지지',
      cooccurs: '',
      related: '',
    };
    g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .text((d) => edgeLabels[d.type] ?? '')
      .attr('font-size', 8)
      .attr('fill', '#71717a')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    // 노드
    const node = g
      .append('g')
      .selectAll('g')
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
          }) as any,
      );

    node
      .append('circle')
      .attr('r', (d) => Math.max(d.size * 0.5, 8))
      .attr('fill', (d) => d.color ?? '#71717a')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node
      .append('text')
      .text((d) => d.label)
      .attr('font-size', (d) => Math.max(9, Math.min(12, d.size * 0.3)))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => Math.max(d.size * 0.5, 8) + 14)
      .attr('fill', '#d4d4d8')
      .attr('pointer-events', 'none');

    // 노드 클릭
    node.on('click', (_event, d) => {
      setSelectedNode(d);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

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
      <CardHeader>
        <CardTitle className="text-lg font-semibold">지식 그래프</CardTitle>
        {/* 엔티티 타입 필터 */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const exists = data.nodes.some((n) => n.group === key);
            if (!exists) return null;
            return (
              <Badge
                key={key}
                variant={activeTypes.has(key) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                style={
                  activeTypes.has(key)
                    ? { backgroundColor: TYPE_COLORS[key], borderColor: TYPE_COLORS[key] }
                    : {}
                }
                onClick={() => toggleType(key)}
              >
                {label} ({data.nodes.filter((n) => n.group === key).length})
              </Badge>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-hidden rounded-lg border bg-card">
          <svg ref={svgRef} width={700} height={450} className="w-full" viewBox="0 0 700 450" />
        </div>

        {/* 노드 상세 패널 */}
        {selectedNode && (
          <div className="mt-3 rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{selectedNode.label}</span>
              <Badge
                variant="secondary"
                className="text-xs"
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
              언급 횟수: {Math.round(selectedNode.size / 3)} | 그룹:{' '}
              {TYPE_LABELS[selectedNode.group] ?? selectedNode.group}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
