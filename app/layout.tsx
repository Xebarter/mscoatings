import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import LayoutClient from '@/components/layout-client'
import StructuredData from '@/components/structured-data'
import { BRAND_ASSETS, BRAND_NAME } from '@/lib/brand'
import { buildGlobalSchemaGraph } from '@/lib/seo/json-ld'
import { buildPageMetadata } from '@/lib/seo/metadata'
import {
  DEFAULT_SITE_DESCRIPTION,
  getSiteUrl,
  HOME_TITLE,
  SEO_KEYWORDS,
} from '@/lib/seo/site'

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: HOME_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    path: '/',
    keywords: [...SEO_KEYWORDS],
  }),
  metadataBase: new URL(getSiteUrl()),
  applicationName: BRAND_NAME,
  manifest: BRAND_ASSETS.webManifest,
  icons: {
    icon: [
      { url: BRAND_ASSETS.faviconIco },
      { url: BRAND_ASSETS.faviconSvg, type: 'image/svg+xml' },
      { url: BRAND_ASSETS.faviconPng, sizes: '96x96', type: 'image/png' },
    ],
    apple: BRAND_ASSETS.appleTouchIcon,
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0F172A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-UG"
      className={`light ${plusJakarta.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="font-sans" suppressHydrationWarning>
        <StructuredData data={buildGlobalSchemaGraph()} />
        <LayoutClient>
          {children}
        </LayoutClient>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
