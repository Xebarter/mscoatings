import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import LayoutClient from '@/components/layout-client'
import StructuredData from '@/components/structured-data'
import { BRAND_ASSETS, BRAND_NAME } from '@/lib/brand'
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
} from '@/lib/seo/json-ld'
import {
  buildPageTitle,
  DEFAULT_SITE_DESCRIPTION,
  getSiteUrl,
  SEO_KEYWORDS,
} from '@/lib/seo/site'

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: buildPageTitle('Professional Automotive & Industrial Coatings'),
  description: DEFAULT_SITE_DESCRIPTION,
  applicationName: BRAND_NAME,
  keywords: [...SEO_KEYWORDS],
  manifest: BRAND_ASSETS.webManifest,
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: BRAND_ASSETS.faviconIco },
      { url: BRAND_ASSETS.faviconSvg, type: 'image/svg+xml' },
      { url: BRAND_ASSETS.faviconPng, sizes: '96x96', type: 'image/png' },
    ],
    apple: BRAND_ASSETS.appleTouchIcon,
  },
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    title: buildPageTitle('Professional Automotive & Industrial Coatings'),
    description: DEFAULT_SITE_DESCRIPTION,
    url: '/',
    locale: 'en_UG',
    images: [
      {
        url: BRAND_ASSETS.logoLarge,
        width: 512,
        height: 512,
        alt: BRAND_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: buildPageTitle('Professional Automotive & Industrial Coatings'),
    description: DEFAULT_SITE_DESCRIPTION,
    images: [BRAND_ASSETS.logoLarge],
  },
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
      lang="en"
      className={`light ${plusJakarta.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="font-sans" suppressHydrationWarning>
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@graph': [buildOrganizationSchema(), buildWebSiteSchema()],
          }}
        />
        <LayoutClient>
          {children}
        </LayoutClient>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
