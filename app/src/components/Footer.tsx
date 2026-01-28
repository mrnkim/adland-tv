export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* AdLand.TV Info */}
          <div>
            <h3 className="text-lg font-bold mb-4">AdLand.TV</h3>
            <p className="text-gray-400 text-sm">
              The world&apos;s largest archive of TV advertisements, now searchable with AI-powered video understanding technology.
            </p>
          </div>

          {/* TwelveLabs CTA */}
          <div>
            <h3 className="text-lg font-bold mb-4">Video AI by TwelveLabs</h3>
            <p className="text-gray-400 text-sm mb-4">
              This search experience is powered by TwelveLabs&apos; multimodal video understanding technology.
            </p>
            <a
              href="https://playground.twelvelabs.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Try with your own videos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://adland.tv" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                  AdLand.TV Original
                </a>
              </li>
              <li>
                <a href="https://twelvelabs.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                  TwelveLabs
                </a>
              </li>
              <li>
                <a href="https://docs.twelvelabs.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                  API Documentation
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} AdLand.TV. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Video AI-Powered by</span>
            <a
              href="https://twelvelabs.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white hover:text-blue-400"
            >
              TwelveLabs
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
