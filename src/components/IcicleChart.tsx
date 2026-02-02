import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { HierarchyNode } from '../utils/hierarchy';
import type { CreditRow } from '../types';
import './IcicleChart.css';

interface IcicleChartProps {
  data: HierarchyNode;
  onLeafClick: (credit: CreditRow) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: {
    name: string;
    type: string;
    count?: number;
    year?: number | null;
    roles?: string[];
    yearRange?: [number, number];
  };
}

type D3Node = d3.HierarchyRectangularNode<HierarchyNode>;

export function IcicleChart({ data, onLeafClick }: IcicleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [focus, setFocus] = useState<D3Node | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<D3Node[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: { name: '', type: '' },
  });

  // Handle escape key to zoom out
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && breadcrumbs.length > 1) {
        const parent = breadcrumbs[breadcrumbs.length - 2];
        setFocus(parent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [breadcrumbs]);

  // Build and render the icicle chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create hierarchy
    const root = d3.hierarchy(data)
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    // Create partition layout
    const partition = d3.partition<HierarchyNode>()
      .size([height, width])
      .padding(1);

    const partitionedRoot = partition(root);

    // Set initial focus to root
    if (!focus) {
      setFocus(partitionedRoot);
      setBreadcrumbs([partitionedRoot]);
    }

    // Color scale
    const color = d3.scaleOrdinal<string>()
      .domain(['root', 'collaborator', 'role', 'release'])
      .range([
        'var(--icicle-root)',
        'var(--icicle-collaborator)',
        'var(--icicle-role)',
        'var(--icicle-release)',
      ]);

    // Get current focus or root
    const currentFocus = focus ?? partitionedRoot;

    // Calculate scale based on focus
    const xScale = d3.scaleLinear()
      .domain([currentFocus.y0, width])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([currentFocus.x0, currentFocus.x1])
      .range([0, height]);

    // Create cell groups
    const cell = svg.selectAll<SVGGElement, D3Node>('g')
      .data(partitionedRoot.descendants())
      .join('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${xScale(d.y0)},${yScale(d.x0)})`);

    // Draw rectangles
    const rect = cell.append('rect')
      .attr('width', d => Math.max(0, xScale(d.y1) - xScale(d.y0) - 1))
      .attr('height', d => Math.max(0, yScale(d.x1) - yScale(d.x0) - 1))
      .attr('fill', d => color(d.data.type))
      .attr('opacity', d => {
        // Hide nodes not in current view
        if (d.y1 <= currentFocus.y0 || d.x0 >= currentFocus.x1 || d.x1 <= currentFocus.x0) {
          return 0;
        }
        return d.data.type === 'release' ? 0.85 : 1;
      })
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        handleNodeClick(d);
      })
      .on('mouseenter', (event, d) => handleMouseEnter(event, d))
      .on('mousemove', (event) => handleMouseMove(event))
      .on('mouseleave', handleMouseLeave);

    // Add labels
    const labelPadding = 6;
    cell.append('text')
      .attr('class', 'cell-label')
      .attr('x', labelPadding)
      .attr('y', d => Math.max(0, yScale(d.x1) - yScale(d.x0)) / 2)
      .attr('dy', '0.35em')
      .attr('fill', d => d.data.type === 'root' ? 'var(--text-primary)' : 'var(--text-primary)')
      .attr('font-size', d => d.data.type === 'root' ? '14px' : d.data.type === 'release' ? '10px' : '11px')
      .attr('font-weight', d => d.data.type === 'root' || d.data.type === 'collaborator' ? '500' : '400')
      .attr('pointer-events', 'none')
      .text(d => {
        const rectWidth = Math.max(0, xScale(d.y1) - xScale(d.y0) - 1);
        const rectHeight = Math.max(0, yScale(d.x1) - yScale(d.x0) - 1);

        if (rectHeight < 14 || rectWidth < 30) return '';

        const maxChars = Math.floor((rectWidth - labelPadding * 2) / 6);
        const label = d.data.type === 'release' && d.data.credit?.year
          ? `${d.data.name} (${d.data.credit.year})`
          : d.data.name;

        return label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
      });

    // Add count badge for internal nodes
    cell.filter(d => d.data.type !== 'release' && d.data.count !== undefined)
      .append('text')
      .attr('class', 'cell-count')
      .attr('x', d => Math.max(0, xScale(d.y1) - xScale(d.y0)) - labelPadding)
      .attr('y', d => Math.max(0, yScale(d.x1) - yScale(d.x0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10px')
      .attr('pointer-events', 'none')
      .text(d => {
        const rectWidth = Math.max(0, xScale(d.y1) - xScale(d.y0) - 1);
        const rectHeight = Math.max(0, yScale(d.x1) - yScale(d.x0) - 1);
        if (rectHeight < 14 || rectWidth < 50) return '';
        return d.data.count?.toString() ?? '';
      });

    // Animation function for zoom
    function zoom(target: D3Node) {
      const duration = 500;

      const newXScale = d3.scaleLinear()
        .domain([target.y0, width])
        .range([0, width]);

      const newYScale = d3.scaleLinear()
        .domain([target.x0, target.x1])
        .range([0, height]);

      cell.transition()
        .duration(duration)
        .attr('transform', d => `translate(${newXScale(d.y0)},${newYScale(d.x0)})`);

      rect.transition()
        .duration(duration)
        .attr('width', d => Math.max(0, newXScale(d.y1) - newXScale(d.y0) - 1))
        .attr('height', d => Math.max(0, newYScale(d.x1) - newYScale(d.x0) - 1))
        .attr('opacity', d => {
          if (d.y1 <= target.y0 || d.x0 >= target.x1 || d.x1 <= target.x0) {
            return 0;
          }
          return d.data.type === 'release' ? 0.85 : 1;
        });

      cell.selectAll<SVGTextElement, D3Node>('.cell-label')
        .transition()
        .duration(duration)
        .attr('y', d => Math.max(0, newYScale(d.x1) - newYScale(d.x0)) / 2)
        .tween('text', function(d) {
          return () => {
            const rectWidth = Math.max(0, newXScale(d.y1) - newXScale(d.y0) - 1);
            const rectHeight = Math.max(0, newYScale(d.x1) - newYScale(d.x0) - 1);

            if (rectHeight < 14 || rectWidth < 30) {
              d3.select(this).text('');
              return;
            }

            const maxChars = Math.floor((rectWidth - labelPadding * 2) / 6);
            const label = d.data.type === 'release' && d.data.credit?.year
              ? `${d.data.name} (${d.data.credit.year})`
              : d.data.name;

            d3.select(this).text(
              label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label
            );
          };
        });

      cell.selectAll<SVGTextElement, D3Node>('.cell-count')
        .transition()
        .duration(duration)
        .attr('x', d => Math.max(0, newXScale(d.y1) - newXScale(d.y0)) - labelPadding)
        .attr('y', d => Math.max(0, newYScale(d.x1) - newYScale(d.x0)) / 2)
        .tween('text', function(d) {
          return () => {
            const rectWidth = Math.max(0, newXScale(d.y1) - newXScale(d.y0) - 1);
            const rectHeight = Math.max(0, newYScale(d.x1) - newYScale(d.x0) - 1);
            if (rectHeight < 14 || rectWidth < 50) {
              d3.select(this).text('');
            } else {
              d3.select(this).text(d.data.count?.toString() ?? '');
            }
          };
        });
    }

    // Handle node click
    function handleNodeClick(d: D3Node) {
      if (d.data.type === 'release' && d.data.credit) {
        onLeafClick(d.data.credit);
      } else if (d.children) {
        setFocus(d);
        zoom(d);

        // Update breadcrumbs
        const path: D3Node[] = [];
        let current: D3Node | null = d;
        while (current) {
          path.unshift(current);
          current = current.parent;
        }
        setBreadcrumbs(path);
      }
    }

    // Tooltip handlers
    function handleMouseEnter(event: MouseEvent, d: D3Node) {
      const content: TooltipState['content'] = {
        name: d.data.name,
        type: d.data.type,
        count: d.data.count ?? d.value,
      };

      if (d.data.type === 'release' && d.data.credit) {
        content.year = d.data.credit.year;
        content.roles = d.data.credit.roles;
      } else if (d.data.yearRange) {
        content.yearRange = d.data.yearRange;
      }

      setTooltip({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        content,
      });
    }

    function handleMouseMove(event: MouseEvent) {
      setTooltip(prev => ({
        ...prev,
        x: event.clientX,
        y: event.clientY,
      }));
    }

    function handleMouseLeave() {
      setTooltip(prev => ({ ...prev, visible: false }));
    }

    // If focus changed, zoom to it
    if (focus && focus !== partitionedRoot) {
      zoom(focus);
    }

  }, [data, focus, onLeafClick]);

  // Handle breadcrumb click
  const handleBreadcrumbClick = useCallback((node: D3Node) => {
    setFocus(node);
    const idx = breadcrumbs.indexOf(node);
    if (idx >= 0) {
      setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
    }
  }, [breadcrumbs]);

  return (
    <div className="icicle-container" ref={containerRef}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="icicle-breadcrumbs">
          {breadcrumbs.map((node, i) => (
            <span key={node.data.id}>
              {i > 0 && <span className="breadcrumb-separator">/</span>}
              <button
                className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? 'active' : ''}`}
                onClick={() => handleBreadcrumbClick(node)}
              >
                {node.data.name}
              </button>
            </span>
          ))}
          <span className="breadcrumb-hint">(Esc to go back)</span>
        </div>
      )}

      <svg ref={svgRef} />

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="icicle-tooltip"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 12,
          }}
        >
          <div className="tooltip-name">{tooltip.content.name}</div>
          <div className="tooltip-type">{tooltip.content.type}</div>
          {tooltip.content.count !== undefined && (
            <div className="tooltip-count">
              {tooltip.content.count} {tooltip.content.count === 1 ? 'credit' : 'credits'}
            </div>
          )}
          {tooltip.content.year !== undefined && (
            <div className="tooltip-year">
              {tooltip.content.year ?? 'Unknown year'}
            </div>
          )}
          {tooltip.content.roles && (
            <div className="tooltip-roles">
              {tooltip.content.roles.join(', ')}
            </div>
          )}
          {tooltip.content.yearRange && (
            <div className="tooltip-year">
              {tooltip.content.yearRange[0]} – {tooltip.content.yearRange[1]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
