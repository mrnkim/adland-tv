'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">AdLand.TV</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-medium ${pathname === '/' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Home
            </Link>
            <Link
              href="/search"
              className={`text-sm font-medium ${pathname === '/search' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Search
            </Link>
            <Link
              href="/browse"
              className={`text-sm font-medium ${pathname === '/browse' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Browse
            </Link>
            <Link
              href="/analyze"
              className={`text-sm font-medium ${pathname === '/analyze' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Analyze
            </Link>
            <a
              href="https://adland.tv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              About
            </a>
          </nav>

          {/* TwelveLabs branding */}
          <div className="flex items-center gap-4">
            <a
              href="https://twelvelabs.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <span>Powered by</span>
              <span className="font-semibold text-gray-700">TwelveLabs</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
