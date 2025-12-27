export function ComicPreview({
  currentPage,
  goToPage,
}: {
  currentPage: number;
  goToPage: (page: number) => void;
}) {
  return (
    <div className="flex w-full lg:w-1/2 mt-12 lg:mt-0 border-t lg:border-t-0 lg:border-l border-border relative items-center justify-center overflow-hidden py-10 lg:py-0">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-30" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Background floating comics - less prominent */}
        <div className="block absolute -top-32 -left-20 opacity-20 animate-float animation-delay-300">
          <div className="bg-white w-48 aspect-3/4 p-2 shadow-2xl rounded-sm rotate-12">
            <div className="w-full h-full bg-neutral-900 border-2 border-black overflow-hidden">
              <img
                src="/manga-style-hero-battle-scene.jpg"
                alt="Background comic"
                className="w-full h-full object-cover opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="block absolute -bottom-40 left-10 opacity-15 animate-float animation-delay-500">
          <div className="bg-white w-56 aspect-3/4 p-2 shadow-2xl rounded-sm -rotate-6">
            <div className="w-full h-full bg-neutral-900 border-2 border-black overflow-hidden">
              <img
                src="/american-comic-superhero-flying.jpg"
                alt="Background comic"
                className="w-full h-full object-cover opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="block absolute top-20 -right-32 opacity-25 animate-float animation-delay-700">
          <div className="bg-white w-52 aspect-3/4 p-2 shadow-2xl rounded-sm -rotate-12">
            <div className="w-full h-full bg-neutral-900 border-2 border-black overflow-hidden">
              <img
                src="/noir-detective-comic-panel-dark.jpg"
                alt="Background comic"
                className="w-full h-full object-cover opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="block absolute bottom-10 -right-24 opacity-18 animate-float animation-delay-1000">
          <div className="bg-white w-44 aspect-3/4 p-2 shadow-2xl rounded-sm rotate-6">
            <div className="w-full h-full bg-neutral-900 border-4 border-black overflow-hidden relative">
              <img
                src="/vintage-comic-book-cover-retro.jpg"
                alt="Background comic"
                className="w-full h-full object-cover opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="bg-white w-80 aspect-3/4 p-2 shadow-2xl rounded-sm hover:shadow-indigo/20 hover:shadow-3xl transition-all duration-300">
            <div className="w-full h-full bg-neutral-900 border-4 border-black overflow-hidden relative">
              {/* Page transition container */}
              <div className="relative w-full h-full">
                {/* Page 1 */}
                <div
                  className={`absolute inset-0 transition-all duration-500 ${
                    currentPage === 1
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-full"
                  }`}
                >
                  <img
                    src="/american-comic-superhero-flying.jpg"
                    alt="Comic preview page 1"
                    className="w-full h-full object-cover opacity-80 grayscale-20 contrast-125"
                  />
                  <div className="scan-line opacity-50" />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-[9px] text-white font-mono uppercase tracking-widest border border-white/10">
                    American Modern
                  </div>
                  <div className="absolute bottom-8 left-4 right-8 bg-white text-black p-2 text-[10px] font-medium border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-tight transform rotate-1">
                    {'"And a hero shall rise!"'}
                  </div>
                </div>

                {/* Page 2 */}
                <div
                  className={`absolute inset-0 transition-all duration-500 ${
                    currentPage === 2
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 translate-x-full"
                  }`}
                >
                  <img
                    src="/manga-style-hero-battle-scene.jpg"
                    alt="Comic preview page 2"
                    className="w-full h-full object-cover opacity-80 grayscale-20 contrast-125"
                  />
                  <div className="scan-line opacity-50" />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-[9px] text-white font-mono uppercase tracking-widest border border-white/10">
                    Manga
                  </div>
                  <div className="absolute bottom-8 left-4 right-8 bg-white text-black p-2 text-[10px] font-medium border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-tight transform -rotate-1">
                    {'"The battle begins!"'}
                  </div>
                </div>

                <div
                  className={`absolute inset-0 transition-all duration-500 ${
                    currentPage === 3
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 translate-x-full"
                  }`}
                >
                  <img
                    src="/comic-book-page-with-superhero-action-scene-noir-s.jpg"
                    alt="Comic preview page 3"
                    className="w-full h-full object-cover opacity-80 grayscale-20 contrast-125"
                  />
                  <div className="scan-line opacity-50" />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-[9px] text-white font-mono uppercase tracking-widest border border-white/10">
                    Noir
                  </div>
                  <div className="absolute bottom-8 left-4 right-8 bg-white text-black p-2 text-[10px] font-medium border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-tight transform -rotate-1">
                    {'"The city needs a hero..."'}
                  </div>
                </div>

                {/* Page 4 */}
                <div
                  className={`absolute inset-0 transition-all duration-500 ${
                    currentPage === 4
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 translate-x-full"
                  }`}
                >
                  <img
                    src="/vintage-superman.jpg"
                    alt="Comic preview page 4"
                    className="w-full h-full object-cover opacity-80 grayscale-20 contrast-125"
                  />
                  <div className="scan-line opacity-50" />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-[9px] text-white font-mono uppercase tracking-widest border border-white/10">
                    Vintage
                  </div>
                  <div className="absolute bottom-8 left-4 right-8 bg-white text-black p-2 text-[10px] font-medium border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-tight transform -rotate-1">
                    {'"Super Action"'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex absolute -right-20 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          <button
            onClick={() => goToPage(1)}
            className={`w-8 h-8 rounded-full glass-panel flex items-center justify-center shadow-lg cursor-pointer transition-all duration-200 ${
              currentPage === 1
                ? "border-indigo bg-indigo/10"
                : "hover:border-indigo/50 hover:bg-indigo/5"
            }`}
            aria-label="Go to page 1"
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                currentPage === 1 ? "bg-indigo" : "bg-muted-foreground"
              }`}
            />
          </button>
          <button
            onClick={() => goToPage(2)}
            className={`w-8 h-8 rounded-full glass-panel flex items-center justify-center shadow-lg cursor-pointer transition-all duration-200 ${
              currentPage === 2
                ? "border-indigo bg-indigo/10"
                : "hover:border-indigo/50 hover:bg-indigo/5"
            }`}
            aria-label="Go to page 2"
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                currentPage === 2 ? "bg-indigo" : "bg-muted-foreground"
              }`}
            />
          </button>
          <button
            onClick={() => goToPage(3)}
            className={`w-8 h-8 rounded-full glass-panel flex items-center justify-center shadow-lg cursor-pointer transition-all duration-200 ${
              currentPage === 3
                ? "border-indigo bg-indigo/10"
                : "hover:border-indigo/50 hover:bg-indigo/5"
            }`}
            aria-label="Go to page 3"
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                currentPage === 3 ? "bg-indigo" : "bg-muted-foreground"
              }`}
            />
          </button>
          <button
            onClick={() => goToPage(4)}
            className={`w-8 h-8 rounded-full glass-panel flex items-center justify-center shadow-lg cursor-pointer transition-all duration-200 ${
              currentPage === 4
                ? "border-indigo bg-indigo/10"
                : "hover:border-indigo/50 hover:bg-indigo/5"
            }`}
            aria-label="Go to page 4"
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                currentPage === 4 ? "bg-indigo" : "bg-muted-foreground"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
