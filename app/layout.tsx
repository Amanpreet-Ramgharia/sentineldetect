import type { Metadata } from 'next'
import { Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' })
const mono   = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-var', display: 'swap' })

export const metadata: Metadata = {
  title: 'SentinelDetect — AI SIEM Detection Rule Generator',
  description: 'Generate production-ready KQL, SPL, and EQL detection rules with MITRE ATT&CK mapping.',
  authors: [{ name: 'Amanpreet Singh Matharu' }],
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#f97316' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="cyber" suppressHydrationWarning>
      <head><link rel="manifest" href="/manifest.json"/></head>
      <body className={`${outfit.variable} ${mono.variable}`}>{children}
      <Analytics />
      </body>
    </html>
  )
}
