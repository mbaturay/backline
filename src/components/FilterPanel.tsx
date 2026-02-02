import { useMemo } from 'react';
import type { FilterState, NormalizedData } from '../types';
import { extractUniqueRoles } from '../utils/filters';
import './FilterPanel.css';

interface FilterPanelProps {
  data: NormalizedData;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  yearRange: { min: number; max: number };
}

export function FilterPanel({ data, filters, onFiltersChange, yearRange }: FilterPanelProps) {
  const allRoles = useMemo(() => extractUniqueRoles(data.credits), [data.credits]);

  // Use computed year range from App (excludes invalid years like 0)
  const yearMin = yearRange.min;
  const yearMax = yearRange.max;

  const handleYearChange = (type: 'min' | 'max', value: number) => {
    const currentRange = filters.yearRange ?? [yearMin, yearMax];
    const newRange: [number, number] =
      type === 'min'
        ? [value, Math.max(value, currentRange[1])]
        : [Math.min(value, currentRange[0]), value];
    onFiltersChange({ ...filters, yearRange: newRange });
  };

  const handleRoleToggle = (role: string) => {
    const newRoles = filters.roles.includes(role)
      ? filters.roles.filter(r => r !== role)
      : [...filters.roles, role];
    onFiltersChange({ ...filters, roles: newRoles });
  };

  const handleTypeToggle = (type: 'band' | 'session') => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handleSearchChange = (query: string) => {
    onFiltersChange({ ...filters, searchQuery: query });
  };

  const handleClearCollaborator = () => {
    onFiltersChange({ ...filters, selectedCollaborator: null });
  };

  const handleResetFilters = () => {
    onFiltersChange({
      yearRange: null,
      roles: [],
      types: [],
      searchQuery: '',
      selectedCollaborator: null,
    });
  };

  // Find selected collaborator name
  const selectedCollaboratorName = filters.selectedCollaborator
    ? data.graph.nodes.find(n => n.id === filters.selectedCollaborator)?.name
    : null;

  const currentRange = filters.yearRange ?? [yearMin, yearMax];

  return (
    <aside className="filter-panel">
      <div className="filter-section">
        <h3 className="filter-title">Search</h3>
        <input
          type="text"
          className="filter-search"
          placeholder="Artist or release..."
          value={filters.searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-section">
        <h3 className="filter-title">Year Range</h3>
        <div className="year-range">
          <div className="year-input-group">
            <label htmlFor="year-min">From</label>
            <input
              type="number"
              id="year-min"
              min={yearMin}
              max={yearMax}
              value={currentRange[0]}
              onChange={e => handleYearChange('min', parseInt(e.target.value))}
            />
          </div>
          <span className="year-separator">-</span>
          <div className="year-input-group">
            <label htmlFor="year-max">To</label>
            <input
              type="number"
              id="year-max"
              min={yearMin}
              max={yearMax}
              value={currentRange[1]}
              onChange={e => handleYearChange('max', parseInt(e.target.value))}
            />
          </div>
        </div>
        <input
          type="range"
          className="year-slider"
          min={yearMin}
          max={yearMax}
          value={currentRange[0]}
          onChange={e => handleYearChange('min', parseInt(e.target.value))}
        />
        <input
          type="range"
          className="year-slider"
          min={yearMin}
          max={yearMax}
          value={currentRange[1]}
          onChange={e => handleYearChange('max', parseInt(e.target.value))}
        />
      </div>

      <div className="filter-section">
        <h3 className="filter-title">Roles</h3>
        <div className="filter-chips">
          {allRoles.map(role => (
            <button
              key={role}
              className={`filter-chip ${filters.roles.includes(role) ? 'active' : ''}`}
              onClick={() => handleRoleToggle(role)}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <h3 className="filter-title">Type</h3>
        <div className="filter-chips">
          <button
            className={`filter-chip ${filters.types.includes('band') ? 'active' : ''}`}
            onClick={() => handleTypeToggle('band')}
          >
            Band
          </button>
          <button
            className={`filter-chip ${filters.types.includes('session') ? 'active' : ''}`}
            onClick={() => handleTypeToggle('session')}
          >
            Session
          </button>
        </div>
      </div>

      {selectedCollaboratorName && (
        <div className="filter-section">
          <h3 className="filter-title">Selected Collaborator</h3>
          <div className="selected-collaborator">
            <span>{selectedCollaboratorName}</span>
            <button
              className="clear-button"
              onClick={handleClearCollaborator}
              aria-label="Clear selection"
            >
              x
            </button>
          </div>
        </div>
      )}

      <button className="reset-button" onClick={handleResetFilters}>
        Reset All Filters
      </button>
    </aside>
  );
}
