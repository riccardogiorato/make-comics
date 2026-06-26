import type React from "react"
import type { Metadata } from "next"
import {
  Inter,
  Bangers,
  Space_Grotesk,
  Instrument_Serif,
} from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import PlausibleProvider from "next-plausible"
import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
})
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})
const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
})

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
      <html
        lang="en"
        className={`${inter.variable} ${bangers.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable}`}
      >
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
