import { useState, useCallback } from 'react';
import './TopBar.css';

interface TopBarProps {
  artistName: string;
  totalCredits: number;
  collaboratorCount: number;
  yearRange: { min: number; max: number };
  onSearch: (query: string) => void;
}

export function TopBar({
  artistName,
  totalCredits,
  collaboratorCount,
  yearRange,
  onSearch,
}: TopBarProps) {
  const [query, setQuery] = useState('');

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
  }, [onSearch]);

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <h1 className="top-bar-title">{artistName}</h1>
      </div>

      <div className="top-bar-center">
        <div className="search-container">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search releases, artists, roles..."
            value={query}
            onChange={handleChange}
          />
          {query && (
            <button className="search-clear" onClick={handleClear} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M10 4L4 10M4 4L10 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="top-bar-right">
        <div className="stat-group">
          <span className="stat-value">{totalCredits.toLocaleString()}</span>
          <span className="stat-label">credits</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-group">
          <span className="stat-value">{collaboratorCount.toLocaleString()}</span>
          <span className="stat-label">collaborators</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-group">
          <span className="stat-value">{yearRange.min}–{yearRange.max}</span>
          <span className="stat-label">years</span>
        </div>
      </div>
    </header>
  );
}
