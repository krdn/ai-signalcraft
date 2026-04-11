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

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(links)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => d.weight),
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // 엣지
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#4a4a4a')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', (d) => Math.max(d.weight * 4, 1));

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
      .attr('r', (d) => Math.max(Math.sqrt(d.size) * 3, 5))
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
      .attr('font-size', (d) => Math.max(9, Math.min(14, Math.sqrt(d.size) * 2)))
      .attr('dx', (d) => Math.max(Math.sqrt(d.size) * 3, 5) + 4)
      .attr('dy', 4)
      .attr('fill', '#e4e4e7')
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
