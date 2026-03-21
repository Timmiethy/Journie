import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ActionButton } from './action-button';

interface HorizontalScrollStripProps {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
}

export function HorizontalScrollStrip({
  children,
  ariaLabel,
  className,
  viewportClassName,
  contentClassName,
}: HorizontalScrollStripProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const syncAffordances = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    setCanScrollPrev(viewport.scrollLeft > 4);
    setCanScrollNext(maxScrollLeft - viewport.scrollLeft > 4);
  }, []);

  useEffect(() => {
    syncAffordances();

    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const handleScroll = () => syncAffordances();
    const resizeObserver = new ResizeObserver(() => syncAffordances());
    const content = viewport.firstElementChild;

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(viewport);
    if (content instanceof HTMLElement) {
      resizeObserver.observe(content);
    }
    window.addEventListener('resize', handleScroll);

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleScroll);
    };
  }, [children, syncAffordances]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      left: Math.max(viewport.clientWidth * 0.82, 180) * direction,
      behavior: 'smooth',
    });
  }, []);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    viewport.scrollBy({
      left: event.deltaY,
      behavior: 'auto',
    });
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      scrollByPage(-1);
      event.preventDefault();
    }

    if (event.key === 'ArrowRight') {
      scrollByPage(1);
      event.preventDefault();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-abyss-950 via-abyss-950/82 to-transparent transition-opacity duration-200',
          canScrollPrev ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-abyss-950 via-abyss-950/82 to-transparent transition-opacity duration-200',
          canScrollNext ? 'opacity-100' : 'opacity-0',
        )}
      />

      {canScrollPrev ? (
        <div className="absolute left-1 top-1/2 z-20 -translate-y-1/2">
          <ActionButton
            size="icon"
            variant="secondary"
            aria-label={`Scroll ${ariaLabel} left`}
            className="h-9 w-9 rounded-full bg-abyss-900/92 backdrop-blur-md"
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </ActionButton>
        </div>
      ) : null}

      {canScrollNext ? (
        <div className="absolute right-1 top-1/2 z-20 -translate-y-1/2">
          <ActionButton
            size="icon"
            variant="secondary"
            aria-label={`Scroll ${ariaLabel} right`}
            className="h-9 w-9 rounded-full bg-abyss-900/92 backdrop-blur-md"
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </ActionButton>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        aria-label={ariaLabel}
        className={cn(
          'scrollbar-none overflow-x-auto scroll-smooth',
          viewportClassName,
        )}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className={cn('inline-flex min-w-max items-stretch', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
