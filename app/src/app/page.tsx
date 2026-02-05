'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SearchBar from '@/components/SearchBar';

const CATEGORY_ICONS: Record<string, string> = {
  'Auto': '🚗',
  'Food & Beverage': '🍔',
  'Tech': '💻',
  'Finance': '💰',
  'Insurance': '🛡️',
  'Healthcare': '🏥',
  'Retail': '🛍️',
  'Entertainment': '🎬',
  'Sports': '⚽',
  'Travel': '✈️',
  'Telecom': '📱',
  'Beauty': '💄',
  'Fashion': '👗',
  'Alcohol': '🍺',
  'Luxury': '💎',
  'Education': '📚',
  'CPG': '🧴',
  'Other': '📦',
};

const COLLECTIONS = [
  {
    id: 'superbowl',
    name: 'Super Bowl LX',
    description: '2026 Super Bowl commercials',
    gradient: 'from-red-500 to-orange-500',
  },
  {
    id: 'award-winners',
    name: 'Award Winners',
    description: 'Cannes Lions & Emmy winners',
    gradient: 'from-yellow-500 to-amber-500',
  },
  {
    id: 'classics',
    name: '90s Nostalgia',
    description: 'Iconic ads from the 1990s',
    gradient: 'from-purple-500 to-pink-500',
  },
];

const SAMPLE_SEARCHES = [
  'emotional car commercials',
  'funny Super Bowl ads',
  'celebrity endorsements',
  'cinematic luxury brands',
  'nostalgic 90s commercials',
];

interface CategoryCount {
  name: string;
  icon: string;
  count: number;
}

export default function HomePage() {
  const router = useRouter();
  const [hoveredCollection, setHoveredCollection] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/videos?pageLimit=50');
        if (!res.ok) return;
        const data = await res.json();
        const counts: Record<string, number> = {};
        for (const video of data.videos || []) {
          const cat = video.user_metadata?.product_category;
          if (cat) {
            counts[cat] = (counts[cat] || 0) + 1;
          }
        }
        const sorted = Object.entries(counts)
          .map(([name, count]) => ({
            name,
            icon: CATEGORY_ICONS[name] || '📦',
            count,
          }))
          .sort((a, b) => b.count - a.count);
        setCategories(sorted);
      } catch {
        // silently fail
      } finally {
        setCategoriesLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const handleSearch = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleCategoryClick = (filter: string) => {
    router.push(`/search?category=${encodeURIComponent(filter)}`);
  };

  const handleCollectionClick = (collectionId: string) => {
    router.push(`/search?collection=${encodeURIComponent(collectionId)}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Search 80,000+ TV Ads Instantly
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Discover iconic commercials with AI-powered semantic search
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search ads by description, theme, or style..."
              size="large"
            />
          </div>

          {/* TwelveLabs Badge */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span className="w-px h-4 bg-gray-300" />
            <span>Video AI-Powered by</span>
            <a
              href="https://twelvelabs.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-700 hover:text-blue-600"
            >
              TwelveLabs
            </a>
            <span className="w-px h-4 bg-gray-300" />
          </div>

          {/* Sample Searches */}
          <div className="mt-8">
            <p className="text-sm text-gray-500 mb-3">Try searching for:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SAMPLE_SEARCHES.map((search) => (
                <button
                  key={search}
                  onClick={() => handleSearch(search)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      {categories.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Explore by Category
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => handleCategoryClick(category.name)}
                  className="flex flex-col items-center justify-center w-36 p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
                >
                  <span className="text-3xl mb-2">{category.icon}</span>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                    {category.name}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    {category.count} {category.count === 1 ? 'ad' : 'ads'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Collections Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Featured Collections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COLLECTIONS.map((collection) => (
              <button
                key={collection.id}
                onClick={() => handleCollectionClick(collection.id)}
                onMouseEnter={() => setHoveredCollection(collection.id)}
                onMouseLeave={() => setHoveredCollection(null)}
                className="relative overflow-hidden rounded-2xl h-48 text-left group"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${collection.gradient} transition-transform duration-300 ${
                    hoveredCollection === collection.id ? 'scale-105' : ''
                  }`}
                />
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative h-full p-6 flex flex-col justify-end text-white">
                  <h3 className="text-xl font-bold mb-1">{collection.name}</h3>
                  <p className="text-sm text-white/80">{collection.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-gray-600 mb-12">
            Powered by TwelveLabs&apos; multimodal video understanding technology
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Semantic Search</h3>
              <p className="text-sm text-gray-600">
                Search using natural language descriptions instead of just keywords
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Visual Understanding</h3>
              <p className="text-sm text-gray-600">
                AI analyzes visual content, scenes, emotions, and style automatically
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Filters</h3>
              <p className="text-sm text-gray-600">
                Filter by theme, emotion, style, era, and more AI-detected attributes
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 p-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white">
            <h3 className="text-xl font-bold mb-2">
              Want to search your own videos?
            </h3>
            <p className="text-blue-100 mb-4">
              Try TwelveLabs Playground to experience AI-powered video search
            </p>
            <a
              href="https://playground.twelvelabs.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Try TwelveLabs Free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
