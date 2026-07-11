import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GuideStep } from './types';

const STORAGE_PREFIX = 'agendali_guide_seen_';

function hasSeenGuide(guideKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + guideKey) === '1';
  } catch {
    return true;
  }
}

function markGuideSeen(guideKey: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + guideKey, '1');
  } catch {
    // ignore (private mode / storage disabled)
  }
}

interface UseInteractiveGuideOptions {
  /** Delay before auto-starting on first visit, lets the page finish rendering. */
  autoStartDelayMs?: number;
}

export function useInteractiveGuide(
  guideKey: string,
  steps: GuideStep[],
  options: UseInteractiveGuideOptions = {}
) {
  const { autoStartDelayMs = 500 } = options;
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Auto-start on first visit to this guide
  useEffect(() => {
    if (steps.length === 0) return;
    if (hasSeenGuide(guideKey)) return;
    const timer = setTimeout(() => {
      setStepIndex(0);
      setIsActive(true);
    }, autoStartDelayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideKey]);

  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (isActive && currentStep?.onEnter) {
      currentStep.onEnter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, stepIndex]);

  const finish = useCallback(() => {
    setIsActive(false);
    markGuideSeen(guideKey);
  }, [guideKey]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= steps.length) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, finish]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const restart = useCallback(() => {
    setStepIndex(0);
    setIsActive(true);
  }, []);

  return useMemo(
    () => ({
      isActive,
      currentStep,
      stepIndex,
      totalSteps: steps.length,
      next,
      prev,
      skip,
      finish,
      restart,
    }),
    [isActive, currentStep, stepIndex, steps.length, next, prev, skip, finish, restart]
  );
}

export type InteractiveGuideState = ReturnType<typeof useInteractiveGuide>;
