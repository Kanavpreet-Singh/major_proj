import './globals.css';
import type { Metadata } from 'next';
import { Instrument_Sans, Newsreader } from 'next/font/google';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

// adjustFontFallback is off because Next 13.5 has no fallback metrics for these fonts
// (it only warns); system-ui / Georgia fallbacks are set in tailwind.config.ts
const sans = Instrument_Sans({ subsets: ['latin'], variable: '--font-sans', adjustFontFallback: false });
const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['normal', 'italic'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'VeriLens',
  description: 'Check claims, documents, images and articles against real evidence.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Font variables live on <html> so Tailwind's base font (set on html) can resolve them
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
