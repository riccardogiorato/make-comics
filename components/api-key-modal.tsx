"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Key, ExternalLink, ArrowRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { IMAGE_PROVIDER_LINK } from "@/lib/utils"
import { useApiKey } from "@/hooks/use-api-key"

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (key: string) => void
}

export function ApiKeyModal({ isOpen, onClose, onSubmit }: ApiKeyModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [existingKey, setApiKey] = useApiKey()

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput((current) => {
        if (existingKey && current === "") {
          return existingKey
        }
        return current
      })
    }
  }, [isOpen, existingKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKeyInput.trim()) return

    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsLoading(false)
    onSubmit(apiKeyInput.trim())
    setApiKeyInput("")
  }

  const handleDelete = () => {
    setApiKey(null)
    setApiKeyInput("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border border-border/50 rounded-lg bg-background max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className="w-14 h-14 glass-panel rounded-full flex items-center justify-center">
              <Key className="w-6 h-6 text-indigo" />
            </div>
          </div>

          <DialogTitle className="text-xl text-center text-white">
            {existingKey
              ? "Update your API key"
              : "Add your API key to continue"}
          </DialogTitle>

          <DialogDescription className="text-center text-muted-foreground">
            {existingKey
              ? "Update your image provider API key or add a new one. You can also delete your existing key."
              : "You've used all your weekly credits! Add an image provider API key for unlimited generation."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="relative">
            <Input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={
                existingKey ? "Your current API key" : "Enter your API key..."
              }
              className="bg-secondary border-border/50 text-white placeholder-muted-foreground py-5 pr-10"
            />
            {apiKeyInput && (
              <button
                type="button"
                onClick={() => setApiKeyInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <a
            href={IMAGE_PROVIDER_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo hover:text-indigo-light flex items-center gap-1.5 transition-colors"
          >
            Learn about the image provider
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={existingKey ? handleDelete : onClose}
              className="flex-1 text-muted-foreground hover:text-white hover:bg-secondary"
            >
              {existingKey ? "Delete API Key" : "Maybe Later"}
            </Button>
            <Button
              type="submit"
              disabled={!apiKeyInput.trim() || isLoading}
              className="flex-1 gap-2 bg-white hover:bg-neutral-200 text-black"
            >
              {isLoading ? "Validating..." : "Continue"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 glass-panel rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Your API key is stored locally and never stored on our servers.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
