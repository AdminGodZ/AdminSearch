"use client";

import { useTheme } from "next-themes";
// The native View Transition callback needs the new theme committed before its snapshot.
// react-doctor-disable-next-line no-flush-sync
import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (
    update: () => Promise<void> | void,
  ) => ViewTransition;
};

type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
};

export function useThemeTransition() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  function setThemeWithTransition(nextTheme: string) {
    const transitionDocument = document as ViewTransitionDocument;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !transitionDocument.startViewTransition
    ) {
      setTheme(nextTheme);
      return;
    }

    const transition = transitionDocument.startViewTransition.call(
      document,
      () => {
        flushSync(() => {
          setTheme(nextTheme);
        });
      },
    );

    void transition.ready.catch(() => undefined);
    void transition.updateCallbackDone.catch(() => undefined);
    void transition.finished.catch(() => undefined);
  }

  return {
    resolvedTheme,
    setTheme: setThemeWithTransition,
    theme,
  };
}
