"use client";

import { useInView } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SpecialTextProps = {
  children: string;
  speed?: number;
  delay?: number;
  className?: string;
  inView?: boolean;
  once?: boolean;
};

const RANDOM_CHARS = "_!X$0-+*#";

function getRandomChar(prevChar?: string) {
  let char: string;

  do {
    char = RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  } while (char === prevChar);

  return char;
}

export function SpecialText({
  children,
  speed = 20,
  delay = 0,
  className,
  inView = false,
  once = true,
}: SpecialTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once, margin: "-100px" });
  const shouldAnimate = inView ? isInView : true;
  const [mounted, setMounted] = useState(false);
  const [hasStarted, setHasStarted] = useState(() => !inView && delay <= 0);
  const [displayText, setDisplayText] = useState(() =>
    " ".repeat(children.length),
  );
  const [currentPhase, setCurrentPhase] = useState<"phase1" | "phase2">(
    "phase1",
  );
  const [animationStep, setAnimationStep] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearStartTimeout = useCallback(() => {
    if (startTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(startTimeoutRef.current);
    startTimeoutRef.current = null;
  }, []);

  const startAnimation = useCallback(() => {
    setHasStarted(true);
    setDisplayText(" ".repeat(children.length));
    setCurrentPhase("phase1");
    setAnimationStep(0);
  }, [children]);

  const runPhase1 = useCallback(() => {
    const maxSteps = children.length * 2;
    const currentLength = Math.min(animationStep + 1, children.length);
    const chars: string[] = [];

    for (let index = 0; index < currentLength; index += 1) {
      const prevChar = index > 0 ? chars[index - 1] : undefined;
      chars.push(getRandomChar(prevChar));
    }

    for (let index = currentLength; index < children.length; index += 1) {
      chars.push("\u00A0");
    }

    setDisplayText(chars.join(""));

    if (animationStep < maxSteps - 1) {
      setAnimationStep((prev) => prev + 1);
      return;
    }

    setCurrentPhase("phase2");
    setAnimationStep(0);
  }, [animationStep, children]);

  const runPhase2 = useCallback(() => {
    const revealedCount = Math.floor(animationStep / 2);
    const chars: string[] = [];

    for (
      let index = 0;
      index < revealedCount && index < children.length;
      index += 1
    ) {
      chars.push(children[index]);
    }

    if (revealedCount < children.length) {
      chars.push(animationStep % 2 === 0 ? "_" : getRandomChar());
    }

    for (let index = chars.length; index < children.length; index += 1) {
      chars.push(getRandomChar());
    }

    setDisplayText(chars.join(""));

    if (animationStep < children.length * 2 - 1) {
      setAnimationStep((prev) => prev + 1);
      return;
    }

    setDisplayText(children);

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [animationStep, children]);

  useEffect(() => {
    if (!shouldAnimate || hasStarted) {
      return clearStartTimeout;
    }

    clearStartTimeout();

    if (delay <= 0) {
      startAnimation();
      return clearStartTimeout;
    }

    startTimeoutRef.current = window.setTimeout(() => {
      startTimeoutRef.current = null;
      startAnimation();
    }, delay * 1000);

    return clearStartTimeout;
  }, [clearStartTimeout, delay, hasStarted, shouldAnimate, startAnimation]);

  useEffect(() => {
    if (!hasStarted) {
      return undefined;
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      if (currentPhase === "phase1") {
        runPhase1();
        return;
      }

      runPhase2();
    }, speed);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentPhase, hasStarted, runPhase1, runPhase2, speed]);

  useEffect(() => {
    if (!hasStarted) {
      return undefined;
    }

    setDisplayText(" ".repeat(children.length));
    setCurrentPhase("phase1");
    setAnimationStep(0);

    return () => {
      clearStartTimeout();

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [children, clearStartTimeout, hasStarted]);

  return (
    <span
      ref={containerRef}
      className={cn(
        "relative inline-block whitespace-pre align-top",
        className,
      )}
    >
      <span aria-hidden className="invisible">
        {children}
      </span>
      {mounted ? (
        <span className="absolute inset-0 inline-flex items-center overflow-hidden whitespace-pre">
          {displayText}
        </span>
      ) : null}
    </span>
  );
}
