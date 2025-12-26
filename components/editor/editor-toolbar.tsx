"use client"

import { ArrowLeft, RefreshCw, Download, Plus, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface EditorToolbarProps {
  title: string
  onContinueStory: () => void
  onInfoClick: () => void
}

export function EditorToolbar({ title, onContinueStory, onInfoClick }: EditorToolbarProps) {
  const router = useRouter()

  return (
    <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/stories")}
          className="hover:bg-secondary text-muted-foreground hover:text-white flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>

        <h1 className="text-sm sm:text-base text-white font-normal tracking-[-0.02em] truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-secondary text-muted-foreground hover:text-white h-8 w-8 sm:h-9 sm:w-9"
          onClick={onInfoClick}
        >
          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Button>

        <Button
          variant="ghost"
          className="hover:bg-secondary text-muted-foreground hover:text-white gap-1.5 sm:gap-2 text-xs h-8 sm:h-9 px-2 sm:px-3 hidden md:flex"
        >
          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Redraw</span>
        </Button>

        <Button
          variant="ghost"
          className="hover:bg-secondary text-muted-foreground hover:text-white gap-1.5 sm:gap-2 text-xs h-8 sm:h-9 px-2 sm:px-3 hidden md:flex"
        >
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Download PDF</span>
        </Button>

        <Button
          onClick={onContinueStory}
          className="gap-1.5 sm:gap-2 text-xs bg-white hover:bg-neutral-200 text-black h-8 sm:h-9 px-3 sm:px-4"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Continue story</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
    </header>
  )
}
