import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { CreditRow } from '../types';
import './Timeline.css';

interface TimelineProps {
  credits: CreditRow[];
  yearRange: [number, number] | null;
  selectedReleaseId: string | null;
  onReleaseClick: (releaseId: string) => void;
  onReleaseHover: (releaseId: string | null) => void;
  onBrushChange: (range: [number, number] | null) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  credit: CreditRow | null;
}

/**
 * Timeline visualization showing credits as dots along a time axis
 *
 * Features:
 * - D3 brush for year range selection
 * - Dots grouped by year with jitter to avoid overlap
 * - Click to select a release
 * - Hover for preview with rich tooltip
 * - Unknown year credits are counted but not plotted
 */
export function Timeline({
  credits,
  yearRange,
  selectedReleaseId,
  onReleaseClick,
  onReleaseHover,
  onBrushChange,
}: TimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    credit: null,
  });

  // Separate credits with known vs unknown years
  const { knownYearCredits, unknownYearCount } = useMemo(() => {
    const known: CreditRow[] = [];
    let unknown = 0;

    credits.forEach(c => {
      if (c.year !== null && c.year > 0) {
        known.push(c);
      } else {
        unknown++;
      }
    });

    return {
      knownYearCredits: known.sort((a, b) => a.year! - b.year!),
      unknownYearCount: unknown,
    };
  }, [credits]);

  // Calculate year extent from known years only
  const yearExtent = useMemo((): [number, number] => {
    if (knownYearCredits.length === 0) {
      return [1970, 2000]; // Fallback range
    }
    const years = knownYearCredits.map(c => c.year!);
    return [Math.min(...years), Math.max(...years)];
  }, [knownYearCredits]);

  // Group credits by year for jittering
  const creditsByYear = useMemo(() => {
    const groups = new Map<number, CreditRow[]>();
    knownYearCredits.forEach(credit => {
      const year = credit.year!;
      const existing = groups.get(year);
      if (existing) {
        existing.push(credit);
      } else {
        groups.set(year, [credit]);
      }
    });
    return groups;
  }, [knownYearCredits]);

  // Assign y positions with jitter
  const creditsWithPosition = useMemo(() => {
    const result: Array<CreditRow & { yOffset: number }> = [];

    creditsByYear.forEach((creditsInYear) => {
      creditsInYear.forEach((credit, index) => {
        // Distribute vertically within the available space
        const jitter = (index / Math.max(creditsInYear.length, 1)) * 0.8 + 0.1;
        result.push({
          ...credit,
          yOffset: jitter,
        });
      });
    });

    return result;
  }, [creditsByYear]);

  // Get node color based on band/session type
  const getPointColor = useCallback((credit: CreditRow) => {
    return credit.isBand ? 'var(--node-band)' : 'var(--node-artist)';
  }, []);

  // Handle tooltip positioning
  const handleMouseMove = useCallback((event: MouseEvent, credit: CreditRow) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setTooltip({
      visible: true,
      x,
      y,
      credit,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  // Setup D3 visualization
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 20, bottom: 40, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const xScale = d3
      .scaleLinear()
      .domain(yearExtent)
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([innerHeight, 0]);

    // Main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // X axis
    const tickCount = Math.min(15, yearExtent[1] - yearExtent[0]);
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(
        d3.axisBottom(xScale)
          .tickFormat(d => d.toString())
          .ticks(tickCount)
      )
      .selectAll('text')
      .attr('fill', 'var(--text-secondary)');

    g.selectAll('.x-axis line, .x-axis path')
      .attr('stroke', 'var(--border-color)');

    // Create brush FIRST so dots render on top
    const brush = d3.brushX<unknown>()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on('end', (event) => {
        if (!event.selection) {
          onBrushChange(null);
          return;
        }
        const [x0, x1] = event.selection as [number, number];
        const startYear = Math.round(xScale.invert(x0));
        const endYear = Math.round(xScale.invert(x1));
        onBrushChange([startYear, endYear]);
      });

    const brushG = g.append('g').attr('class', 'brush').call(brush);

    // Style brush selection
    brushG.selectAll('.selection')
      .attr('fill', 'var(--accent-primary)')
      .attr('fill-opacity', 0.2)
      .attr('stroke', 'var(--accent-primary)');

    // Set initial brush position if yearRange is set
    if (yearRange) {
      const x0 = xScale(Math.max(yearRange[0], yearExtent[0]));
      const x1 = xScale(Math.min(yearRange[1], yearExtent[1]));
      brushG.call(brush.move, [x0, x1]);
    }

    // Draw dots AFTER brush so they're on top
    const dots = g
      .append('g')
      .attr('class', 'dots')
      .selectAll('circle')
      .data(creditsWithPosition)
      .join('circle')
      .attr('cx', d => xScale(d.year!))
      .attr('cy', d => yScale(d.yOffset))
      .attr('r', d => (d.releaseId === selectedReleaseId ? 7 : 5))
      .attr('fill', d => getPointColor(d))
      .attr('opacity', d => {
        if (!yearRange) return 0.85;
        const year = d.year!;
        return year >= yearRange[0] && year <= yearRange[1] ? 0.85 : 0.25;
      })
      .attr('stroke', d => (d.releaseId === selectedReleaseId ? '#fff' : 'transparent'))
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .attr('pointer-events', 'all')
      .on('click', (event, d) => {
        event.stopPropagation();
        onReleaseClick(d.releaseId);
      })
      .on('mouseenter', (event, d) => {
        onReleaseHover(d.releaseId);
        handleMouseMove(event as unknown as MouseEvent, d);
      })
      .on('mousemove', (event, d) => {
        handleMouseMove(event as unknown as MouseEvent, d);
      })
      .on('mouseleave', () => {
        onReleaseHover(null);
        handleMouseLeave();
      });

    // Hover effect - enlarge dot
    dots.on('mouseenter.size', function() {
      d3.select(this)
        .transition()
        .duration(100)
        .attr('r', 8);
    });

    dots.on('mouseleave.size', function(_, d) {
      d3.select(this)
        .transition()
        .duration(100)
        .attr('r', d.releaseId === selectedReleaseId ? 7 : 5);
    });

  }, [
    creditsWithPosition,
    yearExtent,
    yearRange,
    selectedReleaseId,
    getPointColor,
    onReleaseClick,
    onReleaseHover,
    onBrushChange,
    handleMouseMove,
    handleMouseLeave,
  ]);

  if (credits.length === 0) {
    return (
      <div className="timeline" ref={containerRef}>
        <div className="timeline-empty">
          No credits to display with current filters
        </div>
      </div>
    );
  }

  return (
    <div className="timeline" ref={containerRef}>
      <svg ref={svgRef} />

      {/* Custom tooltip */}
      {tooltip.visible && tooltip.credit && (
        <div
          className="timeline-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="tooltip-title">{tooltip.credit.releaseTitle}</div>
          <div className="tooltip-meta">
            <span className="tooltip-year">
              {tooltip.credit.year ?? 'Unknown year'}
            </span>
            <span className="tooltip-separator">•</span>
            <span className="tooltip-artist">{tooltip.credit.primaryArtist}</span>
          </div>
          <div className="tooltip-roles">
            {tooltip.credit.roles.map(role => (
              <span key={role} className="tooltip-role">{role}</span>
            ))}
          </div>
        </div>
      )}

      {/* Stats overlay */}
      <div className="timeline-stats">
        <span>{knownYearCredits.length} credits</span>
        <span>{yearExtent[0]} - {yearExtent[1]}</span>
        {unknownYearCount > 0 && (
          <span className="unknown-count">Unknown: {unknownYearCount}</span>
        )}
      </div>

      {/* Instructions */}
      <div className="timeline-hint">
        Hover for preview • Click to pin details • Drag to filter by year
      </div>
    </div>
  );
}
