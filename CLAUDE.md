# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AdLand.TV is an AI-powered search and analysis platform for discovering and analyzing TV advertisements. It transforms an archive of 80,000+ ads into a semantically searchable creative discovery platform using TwelveLabs multimodal video understanding technology.

**Key integrations:**
- **TwelveLabs SDK** - Video indexing, semantic search, embeddings, and analysis
- **Pinecone** - Vector database for storing and querying video embeddings (1024 dimensions, cosine metric)

## TwelveLabs SDK

### Installation
```bash
npm install twelvelabs
```

### Initialization
```typescript
import TwelveLabs from 'twelvelabs';

const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });
```

### Core Operations

**Search:**
```typescript
const results = await client.search.query({
  indexId: "your-index-id",
  queryText: "emotional car commercials",
  searchOptions: ["visual", "audio"],
  adjustConfidenceLevel: 0.6,
  pageLimit: 10
});

for (const clip of results.data) {
  console.log(`Video: ${clip.videoId}, Score: ${clip.score}`);
  console.log(`Segment: ${clip.start}s - ${clip.end}s`);
}
```

**Video Details with Embedding:**
```typescript
const video = await client.index.video.retrieve(indexId, videoId, {
  embed: true  // Include embedding vectors
});

// Access embedding segments
const segments = video.embedding?.videoEmbedding?.segments;
```

**Create Embeddings (Text-to-Video):**
```typescript
const embedding = await client.embed.create({
  modelName: "Marengo-retrieval-2.7",
  text: "exciting sports moments",
  textTruncate: "end"
});
// Returns 1024-dim vector for Pinecone query
```

**Video Analysis (Generate):**
```typescript
const analysis = await client.generate.text({
  videoId: "your-video-id",
  prompt: "Generate hashtags for: Topic Category, Emotions, Brands, Location, Demographics"
});
```

**List Videos in Index:**
```typescript
const videos = await client.index.video.list(indexId, {
  page: 1,
  pageLimit: 50
});
```

### SDK vs API Naming
SDK uses camelCase (JS convention) instead of API's snake_case:
- `video_id` → `videoId`
- `index_id` → `indexId`
- `search_options` → `searchOptions`
- `page_limit` → `pageLimit`

## Reference Implementation

The `reference/brand-integration-assistant-public/` directory contains an existing Next.js application that serves as a reference. This codebase demonstrates TwelveLabs API integration patterns and can inform implementation decisions.

## Development Commands

```bash
# From reference project (or new project when created)
npm install
npm run dev          # Development server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
```

## Environment Variables

Required in `.env`:
```
TWELVELABS_API_KEY=<key>
NEXT_PUBLIC_CONTENT_INDEX_ID=<footage index>
NEXT_PUBLIC_ADS_INDEX_ID=<ads index>
PINECONE_API_KEY=<key>
PINECONE_INDEX=<index name>
```

## Architecture

### Tech Stack
- **Framework:** Next.js 15 with App Router, React 19, TypeScript
- **Styling:** Tailwind CSS 4, MUI components
- **State Management:** TanStack React Query for server state
- **Video Player:** react-player
- **AI/Video:** TwelveLabs SDK (`twelvelabs`), Pinecone SDK (`@pinecone-database/pinecone`)

### API Layer Pattern

API routes in `src/app/api/` proxy TwelveLabs and Pinecone requests:
- `/api/search` - TwelveLabs semantic search (visual + audio)
- `/api/videos/[videoId]` - Video details with optional embeddings
- `/api/vectors/*` - Pinecone vector operations (store, exists, check-status)
- `/api/embeddingSearch/*` - Text-to-video and video-to-video similarity search
- `/api/analyze` - AI metadata generation (tags, categories)
- `/api/generateChapters` - Video chapter segmentation

### Key Patterns

**Pinecone Vector Query:**
```typescript
const index = getPineconeIndex();
const result = await index.query({
  filter: { tl_index_id: indexId, scope: 'clip' },
  topK: 5,
  includeMetadata: true,
  vector: embeddingVector
});
```

**Embedding Storage:**
- Embeddings stored with metadata: `tl_video_id`, `tl_index_id`, `scope`, `video_file`, `start_time`, `end_time`
- Video embeddings have segments with `start_offset_sec`, `end_offset_sec`, `float[]`

### Data Types

Core types defined in `src/types/index.ts`:
- `VideoData` - Video with system/user metadata, HLS URLs, thumbnails
- `SearchResult` - Search hit with score, segments, matched words
- `EmbeddingSearchResult` - Vector similarity result with metadata
- `Tag` - Category-value pairs for video classification

### Component Structure

- `ContentItem` - Video card with editable metadata tags
- `SearchResults` - Search results display with pagination
- `FilterMenu` - Category-based filtering UI
- `VideoModal` - Video playback with chapter navigation
- `SimilarVideoResults` - Embedding similarity results

## PRD Requirements

Key features from `adlands.tv_PRD.md`:
- Natural language search across 80,000+ ads
- Visual similarity search (image upload/URL)
- Semantic filters (theme, emotion, style, category, era, duration)
- AI analysis panel (scene breakdown, mood detection, color palette)
- TwelveLabs branding ("Video AI-Powered by TwelveLabs")
- Sub-3 second search response times

## TwelveLabs Notes

- Use SDK (`twelvelabs` package) instead of direct API calls
- Embed model: `Marengo-retrieval-2.7` produces 1024-dim vectors
- Rate limits: 200 search calls/asset/month, 30 analyze calls/asset/month
- SDK handles async operations and pagination automatically
