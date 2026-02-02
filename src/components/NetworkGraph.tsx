import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphLink } from '../types';
import { useMeasure } from '../hooks/useMeasure';
import './NetworkGraph.css';

interface NetworkGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  centralNodeId: string;
  selectedNodeId: string | null;
  maxNodes?: number;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
}

// Internal types for D3 simulation
interface SimNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
}

/**
 * Force-directed network graph using D3
 *
 * The graph shows Jeff Porcaro at the center with collaborators around him.
 * Node size = number of credits, link thickness = shared credits.
 */
export function NetworkGraph({
  nodes,
  links,
  centralNodeId,
  selectedNodeId,
  maxNodes = 40,
  onNodeClick,
  onNodeHover,
}: NetworkGraphProps) {
  const [containerRef, bounds] = useMeasure();
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  // Local hover state for visual highlighting (used by CSS classes)
  const [, setHoveredNodeId] = useState<string | null>(null);

  // Limit nodes to top N by credit count (plus central node)
  const visibleNodes = useMemo(() => {
    const centralNode = nodes.find(n => n.id === centralNodeId);
    const otherNodes = nodes
      .filter(n => n.id !== centralNodeId)
      .sort((a, b) => b.creditCount - a.creditCount)
      .slice(0, maxNodes);
    return centralNode ? [centralNode, ...otherNodes] : otherNodes;
  }, [nodes, centralNodeId, maxNodes]);

  // Filter links to only show connections between visible nodes
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map(n => n.id)),
    [visibleNodes]
  );

  const visibleLinks = useMemo(() => {
    return links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  }, [links, visibleNodeIds]);

  // Node size scale
  const nodeSizeScale = useMemo(() => {
    const maxCredits = Math.max(...visibleNodes.map(n => n.creditCount), 1);
    return d3.scaleSqrt().domain([1, maxCredits]).range([8, 35]);
  }, [visibleNodes]);

  // Link width scale
  const linkWidthScale = useMemo(() => {
    const maxWeight = Math.max(...visibleLinks.map(l => l.weight), 1);
    return d3.scaleLinear().domain([1, maxWeight]).range([1, 8]);
  }, [visibleLinks]);

  // Node color by type
  const getNodeColor = useCallback((node: GraphNode) => {
    if (node.id === centralNodeId) return 'var(--node-central)';
    switch (node.type) {
      case 'band':
        return 'var(--node-band)';
      case 'artist':
        return 'var(--node-artist)';
      case 'label':
        return 'var(--node-label)';
      default:
        return 'var(--node-artist)';
    }
  }, [centralNodeId]);

  // Get connected node IDs for highlighting
  const getConnectedNodeIds = useCallback((nodeId: string): Set<string> => {
    const connected = new Set<string>([nodeId]);
    linksRef.current.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as SimNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as SimNode).id;
      if (sourceId === nodeId) connected.add(targetId);
      if (targetId === nodeId) connected.add(sourceId);
    });
    return connected;
  }, []);

  // Initialize D3 visualization
  useEffect(() => {
    if (!svgRef.current || bounds.width === 0 || bounds.height === 0) return;

    const svg = d3.select(svgRef.current);
    const width = bounds.width;
    const height = bounds.height;

    // Set viewBox
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create container group for zoom
    const g = svg.append('g').attr('class', 'graph-container');

    // Deep copy nodes and links for D3 (D3 mutates these)
    const nodesCopy: SimNode[] = visibleNodes.map(n => ({ ...n }));
    const linksCopy: SimLink[] = visibleLinks.map(l => ({
      source: typeof l.source === 'string' ? l.source : l.source.id,
      target: typeof l.target === 'string' ? l.target : l.target.id,
      weight: l.weight,
    }));

    nodesRef.current = nodesCopy;
    linksRef.current = linksCopy;

    // Create force simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodesCopy)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(linksCopy)
          .id(d => d.id)
          .distance(120)
          .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(d => nodeSizeScale(d.creditCount) + 10));

    simulationRef.current = simulation;

    // Fix central node at center
    const centralNode = nodesCopy.find(n => n.id === centralNodeId);
    if (centralNode) {
      centralNode.fx = width / 2;
      centralNode.fy = height / 2;
    }

    // Draw links
    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll<SVGLineElement, SimLink>('line')
      .data(linksCopy)
      .join('line')
      .attr('stroke', 'var(--border-color)')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => linkWidthScale(d.weight));

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(nodesCopy)
      .join('circle')
      .attr('r', d => nodeSizeScale(d.creditCount))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => (d.id === selectedNodeId ? '#fff' : 'transparent'))
      .attr('stroke-width', 2);

    // Draw labels
    const labelGroup = g.append('g').attr('class', 'labels');
    const label = labelGroup
      .selectAll<SVGTextElement, SimNode>('text')
      .data(nodesCopy)
      .join('text')
      .text(d => d.name)
      .attr('font-size', d => (d.id === centralNodeId ? '12px' : '10px'))
      .attr('font-weight', d => (d.id === centralNodeId ? '600' : '400'))
      .attr('fill', 'var(--text-primary)')
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeSizeScale(d.creditCount) + 14);

    // Add drag behavior
    const drag = d3.drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // Don't release central node
        if (d.id !== centralNodeId) {
          d.fx = null;
          d.fy = null;
        }
      });

    node.call(drag);

    // Add click handler
    node.on('click', (event, d) => {
      event.stopPropagation();
      if (d.id !== centralNodeId) {
        onNodeClick(d.id);
      }
    });

    // Add hover handlers
    node.on('mouseenter', (_, d) => {
      setHoveredNodeId(d.id);
      onNodeHover(d.id);

      // Highlight connected nodes and links
      const connected = getConnectedNodeIds(d.id);

      node.classed('dimmed', n => !connected.has(n.id));
      node.classed('highlighted', n => n.id === d.id);

      link.classed('dimmed', l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as SimNode).id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as SimNode).id;
        return sourceId !== d.id && targetId !== d.id;
      });
      link.classed('highlighted', l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as SimNode).id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as SimNode).id;
        return sourceId === d.id || targetId === d.id;
      });

      label.classed('dimmed', n => !connected.has(n.id));
    });

    node.on('mouseleave', () => {
      setHoveredNodeId(null);
      onNodeHover(null);

      // Remove all highlighting
      node.classed('dimmed', false).classed('highlighted', false);
      link.classed('dimmed', false).classed('highlighted', false);
      label.classed('dimmed', false);
    });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);

      node
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0);

      label
        .attr('x', d => d.x ?? 0)
        .attr('y', d => d.y ?? 0);
    });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Double-click to reset zoom
    svg.on('dblclick.zoom', () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    return () => {
      simulation.stop();
    };
  }, [
    bounds.width,
    bounds.height,
    visibleNodes,
    visibleLinks,
    centralNodeId,
    selectedNodeId,
    nodeSizeScale,
    linkWidthScale,
    getNodeColor,
    getConnectedNodeIds,
    onNodeClick,
    onNodeHover,
  ]);

  // Update selected node styling without re-initializing
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Highlight selected node
    svg.selectAll<SVGCircleElement, SimNode>('.nodes circle')
      .attr('stroke', d => (d.id === selectedNodeId ? '#fff' : 'transparent'))
      .attr('stroke-width', d => (d.id === selectedNodeId ? 3 : 2))
      .classed('selected', d => d.id === selectedNodeId);

    // Highlight the link connecting to selected node
    svg.selectAll<SVGLineElement, SimLink>('.links line')
      .classed('selected', l => {
        if (!selectedNodeId) return false;
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as SimNode).id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as SimNode).id;
        return sourceId === selectedNodeId || targetId === selectedNodeId;
      });
  }, [selectedNodeId]);

  return (
    <div className="network-graph" ref={containerRef}>
      <svg ref={svgRef} />
      <div className="network-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--node-central)' }} />
          <span>Jeff Porcaro</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--node-band)' }} />
          <span>Band</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--node-artist)' }} />
          <span>Artist</span>
        </div>
      </div>
    </div>
  );
}
