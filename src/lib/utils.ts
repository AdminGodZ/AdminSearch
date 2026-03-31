import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type QueryParamValue = string | number | null | undefined;

export function mergeSearchParams(
  current: URLSearchParams | { toString(): string },
  updates: Record<string, QueryParamValue>,
) {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
      continue;
    }

    next.set(key, String(value));
  }

  return next;
}

export function buildHref(
  pathname: string,
  current: URLSearchParams | { toString(): string },
  updates: Record<string, QueryParamValue> = {},
) {
  const params = mergeSearchParams(current, updates);
  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}
