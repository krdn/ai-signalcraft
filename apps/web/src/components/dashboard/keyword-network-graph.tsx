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

interface KeywordNetworkGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

export function KeywordNetworkGraph({
  data,
  width = 600,
  height = 400,
  onNodeClick,
}: KeywordNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // 줌/팬
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Force 시뮬레이션
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const links: SimEdge[] = data.edges.map((e) => ({ ...e }));

    // 노드 크기 정규화: count 범위를 반지름 6~32px로 스케일링
    const sizeExtent = d3.extent(nodes, (d) => d.size) as [number, number];
    const radiusScale = d3
      .scaleSqrt()
      .domain([Math.max(sizeExtent[0], 1), Math.max(sizeExtent[1], 1)])
      .range([6, 32])
      .clamp(true);

    const getRadius = (d: SimNode) => radiusScale(d.size);

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(links)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => Math.min(Math.max(d.weight, 0.1), 1)),
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.15))
      .force(
        'collision',
        d3.forceCollide<SimNode>().radius((d) => getRadius(d) + 8),
      )
      .force('x', d3.forceX(width / 2).strength(0.06))
      .force('y', d3.forceY(height / 2).strength(0.06));

    // 엣지
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#64748b')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', (d) => Math.max(Math.min(d.weight, 1) * 4, 1.5));

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

    // 노드 원
    node
      .append('circle')
      .attr('r', getRadius)
      .attr('fill', (d) => d.color ?? '#71717a')
      .attr('fill-opacity', 0.8)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        onNodeClick?.(d.id);
      });

    // 노드 라벨
    node
      .append('text')
      .text((d) => d.label)
      .attr('font-size', (d) => Math.max(11, Math.min(14, getRadius(d) * 0.7 + 8)))
      .attr('font-weight', 600)
      .attr('dx', (d) => getRadius(d) + 5)
      .attr('dy', 4)
      .attr('class', 'fill-muted-foreground')
      .attr('paint-order', 'stroke')
      .attr('style', 'stroke: var(--color-card); stroke-width: 3.5px; stroke-linejoin: round;')
      .attr('pointer-events', 'none');

    // 툴팁을 위한 hover 효과
    node
      .on('mouseenter', function () {
        d3.select(this).select('circle').attr('stroke-width', 3).attr('stroke', '#fff');
      })
      .on('mouseleave', function () {
        d3.select(this).select('circle').attr('stroke-width', 1.5).attr('stroke', '#fff');
      });

    // 시뮬레이션 tick
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
  }, [data, width, height, onNodeClick]);

  useEffect(() => {
    const cleanup = render();
    return () => cleanup?.();
  }, [render]);

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        키워드 네트워크 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-lg border bg-card">
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
