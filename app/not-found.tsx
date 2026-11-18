import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-4 sm:px-6">
      <p className="font-serif text-4xl font-medium sm:text-5xl">
        <span className="mark-false">This page doesn&apos;t exist.</span>
      </p>
      <Button asChild className="mt-10">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
