import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import PlausibleProvider from "next-plausible"
import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"

export const metadata: Metadata = {
  title: "MakeComics - AI Comic Generator",
  description:
    "Create stunning AI-generated comics in seconds. Choose your style, describe your story, and watch the magic happen.",
  openGraph: {
    images: "https://www.makecomics.io/og.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <PlausibleProvider
            src="https://plausible.io/js/script.js"
            scriptProps={
              { "data-domain": "makecomics.io" } as React.ScriptHTMLAttributes<HTMLScriptElement>
            }
          />
        </head>
        <body className="font-sans antialiased">
          {children}
          <Analytics />
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}
