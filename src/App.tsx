import { useState, useMemo, useCallback } from 'react';
import {
  FilterPanel,
  NetworkGraph,
  Timeline,
  DetailsPanel,
  Header,
  Footer,
} from './components';
import { useNormalizedData } from './hooks/useNormalizedData';
import { filterCredits, filterGraphNodes, filterGraphLinks } from './utils/filters';
import type { FilterState } from './types';
import './App.css';

const initialFilters: FilterState = {
  yearRange: null,
  roles: [],
  types: [],
  searchQuery: '',
  selectedCollaborator: null,
};

function App() {
  const { data, loading, error } = useNormalizedData();

  // Filter state
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Selection state
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [hoveredReleaseId, setHoveredReleaseId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Compute filtered data
  // For timeline/details: apply ALL filters including selectedCollaborator
  const filteredCredits = useMemo(() => {
    if (!data) return [];
    return filterCredits(data.credits, filters);
  }, [data, filters]);

  // For graph: apply filters EXCEPT selectedCollaborator
  // This keeps the full network visible when a collaborator is selected
  const graphFilteredCredits = useMemo(() => {
    if (!data) return [];
    const graphFilters = { ...filters, selectedCollaborator: null };
    return filterCredits(data.credits, graphFilters);
  }, [data, filters]);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    const centralNodeId = data.artist.discogsArtistId.toString();
    // Use graphFilteredCredits so network doesn't collapse on collaborator selection
    return filterGraphNodes(data.graph.nodes, graphFilteredCredits, centralNodeId);
  }, [data, graphFilteredCredits]);

  const filteredLinks = useMemo(() => {
    if (!data) return [];
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    return filterGraphLinks(data.graph.links, visibleNodeIds);
  }, [data, filteredNodes]);

  // Compute valid year range from credits with known years
  const computedYearRange = useMemo(() => {
    if (!data) return { min: 1970, max: 2000 };
    const knownYears = data.credits
      .map(c => c.year)
      .filter((y): y is number => y !== null && y > 1900);
    if (knownYears.length === 0) return { min: 1970, max: 2000 };
    return {
      min: Math.min(...knownYears),
      max: Math.max(...knownYears),
    };
  }, [data]);

  // Find selected/hovered items
  const selectedRelease = useMemo(() => {
    if (!selectedReleaseId || !data) return null;
    return data.credits.find(c => c.releaseId === selectedReleaseId) ?? null;
  }, [data, selectedReleaseId]);

  const hoveredRelease = useMemo(() => {
    if (!hoveredReleaseId || !data) return null;
    return data.credits.find(c => c.releaseId === hoveredReleaseId) ?? null;
  }, [data, hoveredReleaseId]);

  const selectedNode = useMemo(() => {
    if (!filters.selectedCollaborator || !data) return null;
    return data.graph.nodes.find(n => n.id === filters.selectedCollaborator) ?? null;
  }, [data, filters.selectedCollaborator]);

  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId || !data) return null;
    return data.graph.nodes.find(n => n.id === hoveredNodeId) ?? null;
  }, [data, hoveredNodeId]);

  // Get credits for the selected collaborator (for the releases list in DetailsPanel)
  const collaboratorCredits = useMemo(() => {
    if (!filters.selectedCollaborator || !data) return [];
    return data.credits.filter(c => c.primaryArtistId === filters.selectedCollaborator);
  }, [data, filters.selectedCollaborator]);

  // Handlers
  const handleNodeClick = useCallback((nodeId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCollaborator: prev.selectedCollaborator === nodeId ? null : nodeId,
    }));
  }, []);

  const handleReleaseClick = useCallback((releaseId: string) => {
    setSelectedReleaseId(prev => (prev === releaseId ? null : releaseId));
  }, []);

  const handleBrushChange = useCallback((range: [number, number] | null) => {
    setFilters(prev => ({ ...prev, yearRange: range }));
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="app">
        <Header data={null} />
        <div className="app-loading">
          <div className="loading-spinner" />
          <p>Loading artist data...</p>
        </div>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="app">
        <Header data={null} />
        <div className="app-error">
          <h2>Failed to load data</h2>
          <p>{error ?? 'Unknown error'}</p>
          <p className="error-hint">
            Make sure you've run <code>npm run fetch</code> to download the artist data.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  const centralNodeId = data.artist.discogsArtistId.toString();

  return (
    <div className="app">
      <Header data={data} yearRange={computedYearRange} />

      <main className="app-main">
        <FilterPanel
          data={data}
          filters={filters}
          onFiltersChange={setFilters}
          yearRange={computedYearRange}
        />

        <div className="app-content">
          <div className="app-visualization">
            <NetworkGraph
              nodes={filteredNodes}
              links={filteredLinks}
              centralNodeId={centralNodeId}
              selectedNodeId={filters.selectedCollaborator}
              onNodeClick={handleNodeClick}
              onNodeHover={setHoveredNodeId}
            />
            <div className="visualization-hint">
              Hover to preview • Click to select • Drag nodes • Scroll to zoom
            </div>
          </div>

          <Timeline
            credits={filteredCredits}
            yearRange={filters.yearRange}
            selectedReleaseId={selectedReleaseId}
            onReleaseClick={handleReleaseClick}
            onReleaseHover={setHoveredReleaseId}
            onBrushChange={handleBrushChange}
          />
        </div>

        <DetailsPanel
          selectedRelease={selectedRelease}
          hoveredRelease={hoveredRelease}
          selectedNode={selectedNode}
          hoveredNode={hoveredNode}
          collaboratorCredits={collaboratorCredits}
          onReleaseClick={handleReleaseClick}
        />
      </main>

      <Footer />
    </div>
  );
}

export default App;
