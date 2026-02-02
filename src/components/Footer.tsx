import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <span className="footer-attribution">
        Data from{' '}
        <a
          href="https://www.discogs.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discogs
        </a>
      </span>
      <span className="footer-divider">|</span>
      <span className="footer-tech">
        Built with React, D3, and TypeScript
      </span>
    </footer>
  );
}
