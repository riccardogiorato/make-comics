import { FEATURED_STYLES } from "@/lib/constants";

const STYLE_PAGES = [
  { id: "american-modern", src: "/style-pages/american-modern.jpg", quote: '"And a hero shall rise!"' },
  { id: "manga",           src: "/style-pages/manga.jpg",           quote: '"Time to save the world!"' },
  { id: "retro-noir",      src: "/style-pages/retro-noir.jpg",      quote: '"The city never sleeps..."' },
  { id: "indie-vector",    src: "/style-pages/indie-vector.jpg",    quote: '"Adventure awaits!"' },
];

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
        {/* Background floating comics — one per style, offset around the main card */}
        {STYLE_PAGES.map((s, i) => {
          const positions = [
            "absolute -top-32 -left-20 opacity-20 animate-float animation-delay-300",
            "absolute -bottom-40 left-10 opacity-15 animate-float animation-delay-500",
            "absolute top-20 -right-32 opacity-25 animate-float animation-delay-700",
            "absolute bottom-10 -right-24 opacity-18 animate-float animation-delay-1000",
          ];
          const sizes   = ["w-48", "w-56", "w-52", "w-44"];
          const rotates = ["rotate-12", "-rotate-6", "-rotate-12", "rotate-6"];
          return (
            <div key={s.id} className={`block ${positions[i]}`}>
              <div className={`bg-white ${sizes[i]} aspect-[3/4] p-2 shadow-2xl rounded-sm ${rotates[i]}`}>
                <div className="w-full h-full bg-neutral-900 border-2 border-black overflow-hidden">
                  <img
                    src={s.src}
                    alt={`${FEATURED_STYLES.find(f => f.id === s.id)?.name} style`}
                    className="w-full h-full object-cover opacity-60"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Main featured card */}
        <div className="relative">
          <div className="bg-white w-80 aspect-[3/4] p-2 shadow-2xl rounded-sm hover:shadow-indigo/20 hover:shadow-3xl transition-all duration-300">
            <div className="w-full h-full bg-neutral-900 border-4 border-black overflow-hidden relative">
              <div className="relative w-full h-full">
                {STYLE_PAGES.map((s, i) => {
                  const pageNum = i + 1;
                  const styleName = FEATURED_STYLES.find(f => f.id === s.id)?.name ?? s.id;
                  const isActive = currentPage === pageNum;
                  const direction = pageNum < currentPage ? "-translate-x-full" : "translate-x-full";
                  return (
                    <div
                      key={s.id}
                      className={`absolute inset-0 transition-all duration-500 ${
                        isActive ? "opacity-100 translate-x-0" : `opacity-0 ${direction}`
                      }`}
                    >
                      <img
                        src={s.src}
                        alt={`${styleName} comic preview`}
                        className="w-full h-full object-cover opacity-80 grayscale-[20%] contrast-125"
                      />
                      <div className="scan-line opacity-50" />
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-[9px] text-white font-mono uppercase tracking-widest border border-white/10">
                        {styleName}
                      </div>
                      <div className="absolute bottom-8 left-4 right-8 bg-white text-black p-2 text-[10px] font-medium border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-tight transform rotate-1">
                        {s.quote}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Dot nav */}
        <div className="hidden lg:flex absolute -right-20 top-1/2 -translate-y-1/2 lg:flex-col gap-3">
          {STYLE_PAGES.map((s, i) => {
            const pageNum = i + 1;
            const isActive = currentPage === pageNum;
            return (
              <button
                key={s.id}
                onClick={() => goToPage(pageNum)}
                className={`w-8 h-8 rounded-full glass-panel flex items-center justify-center shadow-lg cursor-pointer transition-all duration-200 ${
                  isActive ? "border-indigo bg-indigo/10" : "hover:border-indigo/50 hover:bg-indigo/5"
                }`}
                aria-label={`Go to ${FEATURED_STYLES.find(f => f.id === s.id)?.name}`}
              >
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isActive ? "bg-indigo" : "bg-muted-foreground"}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
