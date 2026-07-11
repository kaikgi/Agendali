import { useEffect, useLayoutEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InteractiveGuideState } from './useInteractiveGuide';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const CARD_WIDTH = 340;
const CARD_MARGIN = 16;

function useTargetRect(selector: string | undefined, active: boolean) {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PADDING, left: r.left - PADDING, width: r.width + PADDING * 2, height: r.height + PADDING * 2 });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Give layout a tick to settle (dialogs opening, collapsibles expanding, etc.)
    const t = setTimeout(measure, 80);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector, active]);

  return rect;
}

function computeCardPosition(rect: Rect | null, preferred: 'top' | 'bottom' | 'left' | 'right' | undefined) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  if (!rect) {
    return { top: vh / 2, left: vw / 2, transform: 'translate(-50%, -50%)' as const };
  }

  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;

  let side = preferred;
  if (!side) {
    const spaces = { bottom: spaceBelow, top: spaceAbove, right: spaceRight, left: spaceLeft };
    side = (Object.keys(spaces) as Array<keyof typeof spaces>).reduce((a, b) => (spaces[a] > spaces[b] ? a : b));
  }

  switch (side) {
    case 'bottom':
      return { top: rect.top + rect.height + CARD_MARGIN, left: Math.min(Math.max(rect.left, 16), vw - CARD_WIDTH - 16), transform: 'none' as const };
    case 'top':
      return { top: rect.top - CARD_MARGIN, left: Math.min(Math.max(rect.left, 16), vw - CARD_WIDTH - 16), transform: 'translateY(-100%)' as const };
    case 'left':
      return { top: rect.top, left: rect.left - CARD_MARGIN - CARD_WIDTH, transform: 'none' as const };
    case 'right':
    default:
      return { top: rect.top, left: rect.left + rect.width + CARD_MARGIN, transform: 'none' as const };
  }
}

interface GuideOverlayProps {
  guide: InteractiveGuideState;
}

export function GuideOverlay({ guide }: GuideOverlayProps) {
  const { isActive, currentStep, stepIndex, totalSteps, next, prev, skip } = guide;
  const rect = useTargetRect(currentStep?.target, isActive);

  // Lock page scroll while the guide is active for a calmer walkthrough experience
  useEffect(() => {
    if (!isActive) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isActive]);

  if (!isActive || !currentStep) return null;

  const cardPos = computeCardPosition(rect, currentStep.placement);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guia interativo">
      {rect ? (
        <>
          <div className="fixed bg-black/60 transition-all duration-200" style={{ top: 0, left: 0, width: '100vw', height: Math.max(rect.top, 0) }} />
          <div className="fixed bg-black/60 transition-all duration-200" style={{ top: rect.top + rect.height, left: 0, width: '100vw', bottom: 0 }} />
          <div className="fixed bg-black/60 transition-all duration-200" style={{ top: rect.top, left: 0, width: Math.max(rect.left, 0), height: rect.height }} />
          <div className="fixed bg-black/60 transition-all duration-200" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
          <div
            className="fixed rounded-lg ring-2 ring-primary shadow-[0_0_0_4px_rgba(0,0,0,0.05)] pointer-events-none transition-all duration-200"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/60" />
      )}

      <div
        className="fixed bg-card border rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
        style={{
          top: cardPos.top,
          left: cardPos.left,
          width: CARD_WIDTH,
          transform: cardPos.transform,
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">Guia Interativo</span>
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Fechar guia"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 className="font-semibold text-base leading-snug">{currentStep.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{currentStep.description}</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === stepIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={prev} className="h-8 px-2">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={next} className="h-8">
              {isLast ? 'Concluir' : 'Próximo'}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
