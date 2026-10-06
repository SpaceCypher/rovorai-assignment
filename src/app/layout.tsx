import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AppFooter } from '@/components/app-footer'
import { AppHeader } from '@/components/app-header'
import { OfflineBanner } from '@/components/offline-banner'
import { Providers } from './providers'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: { default: 'RovorAI Tickets', template: '%s · RovorAI Tickets' },
  description: 'Projects and tickets, with GitHub repository insights.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
