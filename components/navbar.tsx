'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/analyze', label: 'Check' },
  { href: '/xray', label: 'Article X-Ray' },
  { href: '/history', label: 'History' },
  { href: '/evaluation', label: 'Evaluation' },
  { href: '/how-it-works', label: 'How it works' },
];

/** A lens over a marked line: the product in one glyph. */
export function LensMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect x="3" y="15" width="14" height="4" rx="1" className="fill-success/60" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M18 18l6.5 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md">
          <LensMark className="h-7 w-7" />
          <span className="font-serif text-[1.4rem] font-semibold tracking-tight">VeriLens</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative py-1 text-sm transition-colors',
                isActive(link.href)
                  ? 'text-foreground after:absolute after:inset-x-0 after:-bottom-[21px] after:h-0.5 after:bg-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="mt-10 flex flex-col">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'border-b border-border/60 py-3 text-base',
                        isActive(link.href) ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
