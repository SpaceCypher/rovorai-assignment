import type { Metadata } from 'next'
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google'
import { AppFooter } from '@/components/app-footer'
import { AppHeader } from '@/components/app-header'
import { OfflineBanner } from '@/components/offline-banner'
import { Providers } from './providers'
import './globals.css'

// Inter for dense UI text, Bricolage Grotesque for headings (character), JetBrains Mono for repo names/ids.
const sans = Inter({ variable: '--font-ui-sans', subsets: ['latin'] })
const heading = Bricolage_Grotesque({ variable: '--font-ui-heading', subsets: ['latin'] })
const mono = JetBrains_Mono({ variable: '--font-ui-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'RovorAI Tickets', template: '%s · RovorAI Tickets' },
  description: 'Projects and tickets, with GitHub repository insights.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only rounded-md border bg-card font-medium shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Providers>
          <AppHeader />
          <OfflineBanner />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
          <AppFooter />
        </Providers>
      </body>
    </html>
  )
}
