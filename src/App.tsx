import { useState, useMemo, useCallback } from 'react';
import { TopBar, IcicleChart, DetailsDrawer, Footer } from './components';
import { useNormalizedData } from './hooks/useNormalizedData';
import { buildHierarchy, filterHierarchy } from './utils/hierarchy';
import type { CreditRow } from './types';
import './App.css';

function App() {
  const { data, loading, error } = useNormalizedData();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditRow | null>(null);

  // Build hierarchy from credits
  const hierarchy = useMemo(() => {
    if (!data) return null;
    return buildHierarchy(data.credits, data.artist.name);
  }, [data]);

  // Filter hierarchy based on search
  const filteredHierarchy = useMemo(() => {
    if (!hierarchy) return null;
    if (!searchQuery.trim()) return hierarchy;
    return filterHierarchy(hierarchy, searchQuery);
  }, [hierarchy, searchQuery]);

  // Compute stats from credits
  const stats = useMemo(() => {
    if (!data) return { yearMin: 1970, yearMax: 2000, collaboratorCount: 0 };

    const years = data.credits
      .map(c => c.year)
      .filter((y): y is number => y !== null && y > 1900);

    const collaboratorIds = new Set(data.credits.map(c => c.primaryArtistId));

    return {
      yearMin: years.length > 0 ? Math.min(...years) : 1970,
      yearMax: years.length > 0 ? Math.max(...years) : 2000,
      collaboratorCount: collaboratorIds.size,
    };
  }, [data]);

  // Handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleLeafClick = useCallback((credit: CreditRow) => {
    setSelectedCredit(credit);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedCredit(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="app app-minimal">
        <div className="app-loading">
          <div className="loading-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data || !filteredHierarchy) {
    return (
      <div className="app app-minimal">
        <div className="app-error">
          <h2>Failed to load data</h2>
          <p>{error ?? 'Unknown error'}</p>
          <p className="error-hint">
            Run <code>npm run fetch</code> to download artist data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app app-minimal">
      <TopBar
        artistName={data.artist.name}
        totalCredits={data.stats.totalCredits}
        collaboratorCount={stats.collaboratorCount}
        yearRange={{ min: stats.yearMin, max: stats.yearMax }}
        onSearch={handleSearch}
      />

      <main className="app-main-icicle">
        <IcicleChart
          data={filteredHierarchy}
          onLeafClick={handleLeafClick}
        />
      </main>

      <DetailsDrawer
        credit={selectedCredit}
        onClose={handleCloseDrawer}
      />

      <Footer />
    </div>
  );
}

export default App;
