import { BookOpen } from 'lucide-react';

export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-700 text-gold-300">
        <BookOpen className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-serif text-base font-semibold text-ink-900">Nubuke</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-500">Foundation Library</span>
      </div>
    </div>
  );
}
