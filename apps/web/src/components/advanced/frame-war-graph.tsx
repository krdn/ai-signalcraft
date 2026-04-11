'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode, GraphEdge as _GraphEdge } from '@ai-signalcraft/core/client';

// D3 시뮬레이션 호환 타입
interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
  type: string;
}

interface FrameWarGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
}

export function FrameWarGraph({ data, width = 600, height = 400 }: FrameWarGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

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
    const legendItems = [
      { label: '지배 프레임', color: '#3b82f6' },
      { label: '위협 프레임', color: '#ef4444' },
      { label: '반전 가능', color: '#eab308' },
      { label: '긍정 프레임', color: '#22c55e' },
      { label: '부정 프레임', color: '#f97316' },
    ];

    legendItems.forEach((item, i) => {
      legend
        .append('circle')
        .attr('cx', 6)
        .attr('cy', i * 20)
        .attr('r', 5)
        .attr('fill', item.color);
      legend
        .append('text')
        .attr('x', 16)
        .attr('y', i * 20 + 4)
        .text(item.label)
        .attr('font-size', 11)
        .attr('font-weight', 500)
        .attr('class', 'fill-foreground');
    });

    // Force 시뮬레이션
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const links: SimEdge[] = data.edges.map((e) => ({ ...e }));

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(links)
          .id((d) => d.id)
          .distance(100)
          .strength((d) => d.weight * 0.8),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(25));

    // 엣지 — type에 따라 스타일 차별화
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        if (d.type === 'threatens') return '#ef4444';
        if (d.type === 'conflicts') return '#f97316';
        if (d.type === 'conflict') return '#a855f7';
        return '#4a4a4a';
      })
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', (d) => Math.max(d.weight * 5, 1.5))
      .attr('stroke-dasharray', (d) => (d.type === 'potential' ? '4,4' : 'none'));

    // 엣지 라벨
    const linkLabel = g
      .append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .text((d) => {
        if (d.type === 'threatens') return '위협';
        if (d.type === 'conflicts') return '충돌';
        if (d.type === 'conflict') return '대립';
        return '';
      })
      .attr('font-size', 10)
      .attr('font-weight', 500)
      .attr('class', 'fill-muted-foreground')
      .attr('text-anchor', 'middle')
      .attr('paint-order', 'stroke')
      .attr('style', 'stroke: var(--color-card); stroke-width: 3px; stroke-linejoin: round;')
      .attr('pointer-events', 'none');

    // 노드
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
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
      .attr('r', (d) => Math.max(d.size * 0.5, 10))
      .attr('fill', (d) => d.color ?? '#71717a')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node
      .append('text')
      .text((d) => d.label)
      .attr('font-size', (d) => Math.max(12, Math.min(14, d.size * 0.35)))
      .attr('font-weight', 600)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => Math.max(d.size * 0.5, 10) + 16)
      .attr('class', 'fill-foreground')
      .attr('paint-order', 'stroke')
      .attr('style', 'stroke: var(--color-card); stroke-width: 3.5px; stroke-linejoin: round;')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      linkLabel
        .attr('x', (d) => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  useEffect(() => {
    const cleanup = render();
    return () => cleanup?.();
  }, [render]);

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        프레임 전쟁 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-card">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
      />
    </div>
  );
}
