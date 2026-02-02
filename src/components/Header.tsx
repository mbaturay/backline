import type { NormalizedData } from '../types';
import './Header.css';

interface HeaderProps {
  data: NormalizedData | null;
  yearRange?: { min: number; max: number };
}

export function Header({ data, yearRange }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title-group">
          <h1 className="header-title">
            {data?.artist.name ?? 'Artist Journey'}
          </h1>
          <p className="header-subtitle">
            {data
              ? 'The invisible backbone of studio pop/rock'
              : 'Loading artist data...'}
          </p>
        </div>
        {data && (
          <div className="header-stats">
            <div className="stat">
              <span className="stat-value">{data.stats.totalCredits}</span>
              <span className="stat-label">Credits</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {data.graph.nodes.length - 1}
              </span>
              <span className="stat-label">Collaborators</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {yearRange ? `${yearRange.min} - ${yearRange.max}` : '?'}
              </span>
              <span className="stat-label">Years Active</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
