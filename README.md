# Artist Journey: Jeff Porcaro

An interactive visualization of Jeff Porcaro's career as a session drummer and founding member of Toto. Explore his vast network of collaborations through a force-directed graph and chronological timeline.

## Features

- **Collaboration Network**: Force-directed graph showing Jeff Porcaro at the center, connected to artists and bands he worked with. Node size reflects the number of credits.
- **Timeline**: Chronological view of all credits with brush selection for year filtering.
- **Interactive Filters**: Filter by year range, role (drums, percussion, producer, etc.), and type (band member vs session work).
- **Details Panel**: Click any node or timeline point to see release details, genres, and links to Discogs.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Visualization**: D3.js (d3-force, d3-scale, d3-brush)
- **Data Source**: Discogs API
- **Styling**: Plain CSS with CSS custom properties

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get a Discogs API token

1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Generate a personal access token
3. Create a `.env` file in the project root:

```env
DISCOGS_TOKEN=your_personal_access_token_here
```

### 3. Fetch artist data

```bash
npm run fetch
```

This downloads Jeff Porcaro's discography from Discogs, normalizes it, and saves it to `data/normalized/jeff-porcaro.json`.

**Options:**
- Use cached data (default): `npm run fetch`
- Force refresh: `REFRESH=true npm run fetch`

The fetch script:
- Implements rate limiting (max 60 requests/minute)
- Caches raw API responses in `data/raw/`
- Handles pagination automatically
- Normalizes roles and credits into a graph structure

### 4. Start the dev server

```bash
npm run dev
```

The app will open at `http://localhost:3000`.

## Project Structure

```
backline/
├── data/
│   ├── raw/              # Cached Discogs API responses
│   └── normalized/       # Processed data for the app
├── public/
│   └── data/normalized/  # Served JSON files
├── scripts/
│   ├── discogsClient.ts  # Discogs API client with caching
│   └── fetchDiscogs.ts   # Main data fetching script
├── src/
│   ├── components/       # React components
│   │   ├── FilterPanel   # Left sidebar with filters
│   │   ├── NetworkGraph  # D3 force-directed graph
│   │   ├── Timeline      # D3 timeline with brush
│   │   ├── DetailsPanel  # Right sidebar with details
│   │   ├── Header        # App header with stats
│   │   └── Footer        # Attribution footer
│   ├── hooks/
│   │   └── useNormalizedData.ts  # Data loading hook
│   ├── types/
│   │   └── index.ts      # TypeScript type definitions
│   ├── utils/
│   │   └── filters.ts    # Filter logic
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
└── package.json
```

## Data Model

The normalized data structure is designed for efficient D3 rendering:

```typescript
interface NormalizedData {
  artist: { name, discogsArtistId, profile, imageUrl }
  credits: CreditRow[]      // Individual release credits (for timeline)
  graph: {
    nodes: GraphNode[]      // Artists/bands (for network)
    links: GraphLink[]      // Connections between nodes
  }
  stats: { totalCredits, yearMin, yearMax, topCollaborators }
}
```

**Why network nodes are collaborators, not releases:**

- Keeps the graph manageable (40 nodes vs 500+ releases)
- Tells a clearer story about working relationships
- Link weight shows collaboration frequency
- Releases are shown in the timeline instead

## Architecture Decisions

1. **File-based caching**: Raw API responses are cached as JSON files to avoid hitting rate limits during development and enable offline iteration.

2. **Role normalization**: Discogs roles are inconsistent ("Drums", "Drum", "Drum Programming"). We normalize to a canonical set for filtering.

3. **Band detection heuristic**: Credits for "Toto" are marked as band work; others default to session work. This is imperfect but works for MVP.

4. **D3 + React integration**: D3 manages the SVG via refs, React manages data flow. This avoids fighting between the two frameworks.

## License

MIT

---

Data from [Discogs](https://www.discogs.com)
