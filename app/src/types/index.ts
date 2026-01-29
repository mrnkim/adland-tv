// Video data from TwelveLabs
export interface VideoData {
  _id: string;
  index_id?: string;
  created_at?: string;
  updated_at?: string;
  user_metadata?: UserMetadata;
  system_metadata?: SystemMetadata;
  hls?: {
    video_url?: string;
    thumbnail_urls?: string[];
    status?: string;
    updated_at?: string;
  };
}

export interface UserMetadata {
  title?: string;
  brand?: string;
  description?: string;
  collection?: string;
  author?: string;
  source_url?: string;
  youtube_url?: string;
  adland_tags?: string;
  theme?: string;
  emotion?: string;
  visual_style?: string;
  sentiment?: string;
  product_category?: string;
  era_decade?: string;
  celebrities?: string;
  analyzed_at?: string;
  [key: string]: string | undefined;
}

export interface SystemMetadata {
  filename?: string;
  video_title?: string;
  duration?: number;
  fps?: number;
  height?: number;
  width?: number;
  size?: number;
}

// Search result from TwelveLabs
export interface SearchResult {
  _id: string;
  index_id?: string;
  video_id: string;
  score: number;
  confidence?: string;
  duration?: number;
  thumbnail_url?: string;
  video_url?: string;
  video_title?: string;
  start?: number;
  end?: number;
  segments?: Array<{
    start: number;
    end: number;
    score: number;
    matched_words?: string[];
  }>;
  metadata?: UserMetadata;
}

export interface SearchResponse {
  pageInfo: {
    page: number;
    total_page: number;
    total_results: number;
    next_page_token?: string;
  };
  results: SearchResult[];
}

// Filter options based on PRD
export const FILTER_OPTIONS = {
  theme: ["Humor", "Emotional", "Inspirational", "Educational", "Dramatic", "Nostalgic", "Adventurous", "Romantic", "Celebratory", "Empowering"],
  emotion: ["Happy", "Sad", "Exciting", "Calming", "Suspenseful", "Heartwarming", "Confident", "Playful", "Hopeful", "Nostalgic", "Empowering"],
  visual_style: ["Cinematic", "Animated", "Documentary", "Minimalist", "Bold/Colorful", "Black & White", "Retro", "High-energy", "Lifestyle", "Glamorous", "Artistic"],
  sentiment: ["Positive", "Neutral", "Provocative", "Negative"],
  product_category: ["Auto", "Tech", "Finance", "Insurance", "Healthcare", "Retail", "Food & Beverage", "Household & Personal Care", "Entertainment", "Sports", "Travel", "Telecom", "Beauty", "Fashion", "Luxury", "Education", "Other"],
  era_decade: ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"],
} as const;

export type FilterCategory = keyof typeof FILTER_OPTIONS;

export interface ActiveFilters {
  [key: string]: string[];
}

// Collection type for featured collections
export interface Collection {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
}

// Category for browse by category
export interface Category {
  id: string;
  name: string;
  icon: string;
  filter: {
    category: FilterCategory;
    value: string;
  };
}
