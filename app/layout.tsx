import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import LayoutClient from '@/components/layout-client'
import { BRAND_ASSETS, BRAND_NAME } from '@/lib/brand'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] })

const siteDescription =
  'Premium automotive coatings and industrial paint solutions engineered for durability, innovation, and exceptional finishes.'

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Professional Automotive & Industrial Coatings`,
  description: siteDescription,
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
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} | Professional Automotive & Industrial Coatings`,
    description: siteDescription,
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
    card: 'summary',
    title: `${BRAND_NAME} | Professional Automotive & Industrial Coatings`,
    description: siteDescription,
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
      className={`light ${inter.variable} ${manrope.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="font-sans" suppressHydrationWarning>
        <LayoutClient>
          {children}
        </LayoutClient>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
