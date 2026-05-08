"use client";

import { useEffect, useState } from "react";
import { IMAGE_PROVIDER_LINK, IMAGE_PROVIDER_NAME } from "@/lib/utils";

export function LandingHero() {
  const [pagesLast24h, setPagesLast24h] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.pagesLast24h === "number") {
          setPagesLast24h(data.pagesLast24h);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const roundedCount =
    pagesLast24h !== null && pagesLast24h >= 10
      ? Math.floor(pagesLast24h / 10) * 10
      : null;

  return (
    <header className="relative py-8 sm:py-12 md:py-16 lg:py-0">
      <div className="relative z-10">
        <div className="lg:text-left text-center">
          <a
            href={IMAGE_PROVIDER_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center items-center gap-1 px-2.5 py-1 rounded-full border border-border glass-panel mb-4 sm:mb-6 w-fit"
          >
            <span className="text-[10px] font-medium text-muted-foreground tracking-[-0.015em]">
              Image generation by {IMAGE_PROVIDER_NAME}
            </span>
          </a>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-foreground uppercase mb-4 sm:mb-5 tracking-wide font-heading font-semibold leading-tight sm:leading-[5.2rem]">
            Create stunning{" "}
            <span className="text-indigo font-semibold">comics</span>
          </h1>

          <p className="text-muted-foreground leading-relaxed max-w-md mx-auto lg:mx-0 tracking-[-0.02em] px-4 sm:px-0 text-sm">
            Describe your scene, choose a style, and let AI render professional
            comic panels instantly.
          </p>

          {roundedCount !== null && (
            <p className="text-muted-foreground leading-relaxed max-w-md mx-auto lg:mx-0 tracking-[-0.02em] px-4 sm:px-0 text-sm mt-2">
              More than{" "}
              <span className="text-indigo font-semibold">
                {roundedCount.toLocaleString()}
              </span>{" "}
              comic pages have been generated in the last 24 hours.
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
