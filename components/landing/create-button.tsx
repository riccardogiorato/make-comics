"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useS3Upload } from "next-s3-upload"
import { useAuth, SignInButton } from "@clerk/nextjs"

interface CreateButtonProps {
  prompt: string
  style: string
  characterFiles: File[]
}

export function CreateButton({ prompt, style, characterFiles }: CreateButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const { toast } = useToast()
  const { uploadToS3 } = useS3Upload()
  const { isSignedIn } = useAuth()

  useEffect(() => {
    if (!isLoading) return

    const steps = ["Enhancing prompt...", "Generating scenes...", "Creating your comic..."]
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep += 1
      if (currentStep < steps.length) {
        setLoadingStep(currentStep)
      } else {
        clearInterval(interval)
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [isLoading])

  const handleCreate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a prompt to generate your comic",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    setIsLoading(true)
    setLoadingStep(0)

    try {
      const apiKey = localStorage.getItem("together_api_key")
      const characterUploads = await Promise.all(characterFiles.map((file) => uploadToS3(file).then(({ url }) => url)))

      // Use API to create story and generate first page
      const response = await fetch("/api/generate-comic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          apiKey,
          style,
          characterImages: characterUploads,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create story")
      }

      const result = await response.json()

      // Redirect to the story editor using slug
      router.push(`/editor/${result.storySlug}`)

    } catch (error) {
      console.error("Error creating comic:", error)
      toast({
        title: "Creation failed",
        description: error instanceof Error ? error.message : "Failed to create comic. Please try again.",
        variant: "destructive",
        duration: 4000,
      })
      setIsLoading(false)
    }
  }



  const loadingSteps = ["Enhancing prompt...", "Generating scenes...", "Creating your comic..."]

  return (
    <div className="pt-2">
      {isSignedIn ? (
        <Button
          onClick={handleCreate}
          disabled={isLoading || !prompt.trim()}
          className="w-full sm:w-auto sm:min-w-40 bg-white hover:bg-neutral-200 text-black px-8 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-3 tracking-tight"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium tracking-tight">{loadingSteps[loadingStep]}</span>
            </>
          ) : (
            <>
              Generate
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      ) : (
        <SignInButton mode="modal">
          <Button className="w-full sm:w-auto sm:min-w-40 bg-white hover:bg-neutral-200 text-black px-8 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-3 tracking-tight">
            Login to create your comic
            <ArrowRight className="w-4 h-4" />
          </Button>
        </SignInButton>
      )}
    </div>
  )
}
