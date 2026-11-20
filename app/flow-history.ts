'use client';

import {useEffect, useRef, useState} from 'react';

type FlowEntry = {key: string; step: number; index: number; previous: number | null};

/** Keep the browser's Back and Forward buttons inside a booking flow without
 * putting a customer's details or private link in browser history. */
export function useFlowHistory(key: string) {
  const [step, setStep] = useState(0);
  const current = useRef<FlowEntry>({key, step: 0, index: 0, previous: null});
  const confirmed = useRef(false);

  useEffect(() => {
    current.current = {key, step: 0, index: 0, previous: null};
    confirmed.current = false;
    window.history.replaceState({...window.history.state, popinFlow: current.current}, '');
    const handlePop = (event: PopStateEvent) => {
      const entry = event.state?.popinFlow as FlowEntry | undefined;
      if (!entry || entry.key !== key) return;
      if (confirmed.current) {
        const safe = {...entry, step: 3, previous: null};
        current.current = safe;
        window.history.replaceState({...window.history.state, popinFlow: safe}, '');
        setStep(3);
      } else {
        current.current = entry;
        setStep(entry.step);
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [key]);

  function pushStep(next: number) {
    const previous = current.current;
    const entry = {key, step: next, index: previous.index + 1, previous: previous.step};
    window.history.pushState({...window.history.state, popinFlow: entry}, '');
    current.current = entry;
    setStep(next);
  }
  function replaceStep(next: number, lock = false) {
    const entry = {...current.current, key, step: next};
    window.history.replaceState({...window.history.state, popinFlow: entry}, '');
    current.current = entry;
    if (lock) confirmed.current = true;
    setStep(next);
  }
  function backStep(fallback: number) {
    if (current.current.index > 0 && current.current.previous === fallback) {
      window.history.back();
    } else {
      replaceStep(fallback);
    }
  }
  return {step, pushStep, replaceStep, backStep};
}
