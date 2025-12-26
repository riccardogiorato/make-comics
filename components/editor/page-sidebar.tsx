"use client"

import { Plus, Loader2, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserButton } from "@clerk/nextjs"

interface PageData {
  id: number
  title: string
  image: string
  prompt: string
  characterUpload?: string
  style: string
}

interface PageSidebarProps {
  pages: PageData[]
  currentPage: number
  onPageSelect: (index: number) => void
  onAddPage: () => void
  loadingPageId?: number | null
  onApiKeyClick?: () => void
}

export function PageSidebar({
  pages,
  currentPage,
  onPageSelect,
  onAddPage,
  loadingPageId,
  onApiKeyClick,
}: PageSidebarProps) {
  return (
    <aside className="w-16 md:w-20 border-r border-border/50 bg-background/50 flex flex-col items-center py-4 gap-2 justify-between">
      {/* Top section: page numbers */}
      <div className="flex flex-col items-center gap-2">
        {pages.map((page, index) => (
          <button
            key={page.id}
            onClick={() => onPageSelect(index)}
            disabled={loadingPageId === page.id}
            className={`
              w-9 h-9 rounded-md transition-all
              flex items-center justify-center font-medium text-sm tracking-tight
              ${
                currentPage === index
                  ? "bg-black border-2 border-indigo text-white shadow-lg shadow-indigo/20"
                  : "glass-panel glass-panel-hover text-muted-foreground hover:text-white"
              }
              ${loadingPageId === page.id ? "opacity-50" : ""}
            `}
          >
            {loadingPageId === page.id ? <Loader2 className="w-4 h-4 animate-spin" /> : index + 1}
          </button>
        ))}

        <Button
          onClick={onAddPage}
          variant="ghost"
          size="icon"
          className="w-9 h-9 bg-white hover:bg-neutral-200 text-black border-0 transition-all group"
        >
          <Plus className="w-4 h-4 text-black transition-transform group-hover:scale-110" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3">
        {/* API Key Button */}
        <Button
          onClick={onApiKeyClick}
          variant="ghost"
          size="icon"
          className="w-9 h-9 glass-panel glass-panel-hover text-muted-foreground hover:text-white"
          title="Manage API Key"
        >
          <Key className="w-4 h-4" />
        </Button>

        <div className="w-9 h-9 glass-panel glass-panel-hover rounded-md flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-full h-full rounded-md",
              },
            }}
          />
        </div>
      </div>
    </aside>
  )
}
