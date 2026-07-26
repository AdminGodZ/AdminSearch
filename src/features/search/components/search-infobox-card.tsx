"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { buildHref } from "@/features/search/lib/url-state";
import type {
  SearchInfobox,
  SearchInfoboxAttribute,
} from "@/features/search/types";
import { cn } from "@/lib/utils";

const COLLAPSIBLE_SUMMARY_LENGTH = 320;
const OVERVIEW_EXCERPT_LENGTH = 260;
const INITIAL_VISIBLE_FACTS = 6;
const INITIAL_VISIBLE_LINKS = 4;
const INITIAL_VISIBLE_RELATED_TOPICS = 2;
const INITIAL_VISIBLE_RELATED_SUGGESTIONS = 4;

function attributeUsesFullWidth(attribute: SearchInfoboxAttribute) {
  return Boolean(
    attribute.image ||
      attribute.label.length > 18 ||
      (attribute.value?.length ?? 0) > 48,
  );
}

function createOverviewExcerpt(content: string) {
  const candidate = content.slice(0, OVERVIEW_EXCERPT_LENGTH);
  const lastWordBoundary = candidate.lastIndexOf(" ");
  const excerpt =
    lastWordBoundary > OVERVIEW_EXCERPT_LENGTH * 0.75
      ? candidate.slice(0, lastWordBoundary)
      : candidate;

  return `${excerpt.trimEnd()}…`;
}

export function SearchInfoboxCard({
  infobox,
  openInNewTab,
  pathname,
  searchParams,
}: {
  infobox: SearchInfobox;
  openInNewTab: boolean;
  pathname: string;
  searchParams: { toString(): string };
}) {
  const t = useTranslations("Search");
  const overviewId = useId();
  const factsId = useId();
  const linksId = useId();
  const relatedTopicsId = useId();
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [areFactsExpanded, setAreFactsExpanded] = useState(false);
  const [areLinksExpanded, setAreLinksExpanded] = useState(false);
  const [areRelatedTopicsExpanded, setAreRelatedTopicsExpanded] =
    useState(false);
  const overviewIsCollapsible =
    (infobox.content?.length ?? 0) > COLLAPSIBLE_SUMMARY_LENGTH;
  const visibleOverview =
    infobox.content && overviewIsCollapsible && !isOverviewExpanded
      ? createOverviewExcerpt(infobox.content)
      : infobox.content;
  const additionalUrls = infobox.urls.filter(
    (urlEntry) => !infobox.url || urlEntry.url !== infobox.url,
  );
  const visibleUrls = areLinksExpanded
    ? additionalUrls
    : additionalUrls.slice(0, INITIAL_VISIBLE_LINKS);
  const hiddenUrlCount = Math.max(
    additionalUrls.length - INITIAL_VISIBLE_LINKS,
    0,
  );
  const compactAttributes = infobox.attributes.filter(
    (attribute) => !attributeUsesFullWidth(attribute),
  );
  const keyAttributes = compactAttributes.length
    ? compactAttributes.slice(0, INITIAL_VISIBLE_FACTS)
    : infobox.attributes.slice(0, 1);
  const hiddenFactCount = Math.max(
    infobox.attributes.length - keyAttributes.length,
    0,
  );
  const visibleAttributes = areFactsExpanded
    ? infobox.attributes
    : keyAttributes;
  const collapsedRelatedTopics = infobox.relatedTopics
    .slice(0, INITIAL_VISIBLE_RELATED_TOPICS)
    .map((topic) => ({
      ...topic,
      suggestions: topic.suggestions.slice(
        0,
        INITIAL_VISIBLE_RELATED_SUGGESTIONS,
      ),
    }));
  const relatedTopicsHaveOverflow =
    infobox.relatedTopics.length > INITIAL_VISIBLE_RELATED_TOPICS ||
    infobox.relatedTopics
      .slice(0, INITIAL_VISIBLE_RELATED_TOPICS)
      .some(
        (topic) =>
          topic.suggestions.length > INITIAL_VISIBLE_RELATED_SUGGESTIONS,
      );
  const visibleRelatedTopics = areRelatedTopicsExpanded
    ? infobox.relatedTopics
    : collapsedRelatedTopics;

  return (
    <Card
      data-testid="search-infobox"
      className="overflow-hidden rounded-[28px] border-transparent bg-[var(--surface-panel)] py-0 ring-0 shadow-none"
    >
      <CardContent className="p-0">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {infobox.imageUrl ? (
              <div className="flex h-24 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-3">
                {/* biome-ignore lint/performance/noImgElement: Infobox images are remote SearXNG-provided media with dynamic origins. */}
                <img
                  src={infobox.imageUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}

            <div className="min-w-0 flex-1 pt-0.5">
              {infobox.url ? (
                <a
                  href={infobox.url}
                  target={openInNewTab ? "_blank" : undefined}
                  rel={openInNewTab ? "noreferrer noopener" : undefined}
                  className="group inline-flex max-w-full items-start gap-1.5 hover:underline"
                >
                  <h2 className="min-w-0 text-[22px] leading-tight font-semibold tracking-tight text-[var(--text-strong)]">
                    {infobox.title}
                  </h2>
                  <ExternalLink
                    aria-hidden="true"
                    className="mt-1 size-3.5 shrink-0 text-[var(--text-soft)] transition-colors group-hover:text-foreground"
                  />
                </a>
              ) : (
                <h2 className="text-[22px] leading-tight font-semibold tracking-tight text-[var(--text-strong)]">
                  {infobox.title}
                </h2>
              )}

              {infobox.source ? (
                <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-soft)]">
                  {infobox.source}
                </p>
              ) : null}
            </div>
          </div>

          {infobox.content ? (
            <section className="mt-5 border-t border-[var(--surface-separator)] pt-4">
              <p className="mb-2 text-[12px] font-medium text-[var(--text-soft)]">
                {t("overview")}
              </p>
              <p
                id={overviewId}
                className="text-[14px] leading-6 text-[var(--text-body)]"
              >
                {visibleOverview}
              </p>

              {overviewIsCollapsible ? (
                <button
                  type="button"
                  aria-controls={overviewId}
                  aria-expanded={isOverviewExpanded}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                  onClick={() => setIsOverviewExpanded((expanded) => !expanded)}
                >
                  {isOverviewExpanded ? t("showLess") : t("showMore")}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 transition-transform",
                      isOverviewExpanded && "rotate-180",
                    )}
                  />
                </button>
              ) : null}
            </section>
          ) : null}
        </div>

        {infobox.attributes.length ? (
          <section className="border-t border-[var(--surface-separator)] px-5 py-5 sm:px-6">
            <h3 className="text-[12px] font-medium text-[var(--text-soft)]">
              {t("keyFacts")}
            </h3>
            <dl id={factsId} className="mt-3 grid grid-cols-2 gap-2.5">
              {visibleAttributes.map((attribute) => {
                const usesFullWidth = attributeUsesFullWidth(attribute);

                return (
                  <div
                    key={`${infobox.id}-${attribute.label}`}
                    className={cn(
                      "min-w-0 rounded-xl bg-[var(--control-bg)] px-3.5 py-3",
                      usesFullWidth && "col-span-2",
                    )}
                  >
                    <dt className="text-[11px] leading-4 font-medium text-[var(--text-soft)]">
                      {attribute.label}
                    </dt>
                    {attribute.image || attribute.value ? (
                      <dd className="mt-1.5 min-w-0 space-y-2.5">
                        {attribute.image ? (
                          <div className="inline-flex max-w-full items-center justify-center overflow-hidden rounded-lg bg-white p-2.5">
                            {/* biome-ignore lint/performance/noImgElement: Infobox attribute images are remote SearXNG-provided media with dynamic origins. */}
                            <img
                              src={attribute.image.src}
                              alt={attribute.image.alt ?? attribute.label}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="max-h-28 max-w-full object-contain"
                            />
                          </div>
                        ) : null}
                        {attribute.value ? (
                          <p
                            className={cn(
                              "break-words text-[13px] leading-5 [overflow-wrap:anywhere]",
                              usesFullWidth
                                ? "text-[var(--text-body)]"
                                : "font-medium text-[var(--text-strong)]",
                            )}
                          >
                            {attribute.value}
                          </p>
                        ) : null}
                      </dd>
                    ) : null}
                  </div>
                );
              })}
            </dl>

            {hiddenFactCount ? (
              <button
                type="button"
                aria-controls={factsId}
                aria-expanded={areFactsExpanded}
                className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                onClick={() => setAreFactsExpanded((expanded) => !expanded)}
              >
                {areFactsExpanded
                  ? t("showFewerFacts")
                  : t("showMoreFacts", {
                      count: hiddenFactCount,
                    })}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform",
                    areFactsExpanded && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </section>
        ) : null}

        {additionalUrls.length ? (
          <section className="border-t border-[var(--surface-separator)] px-5 py-5 sm:px-6">
            <h3 className="text-[12px] font-medium text-[var(--text-soft)]">
              {t("links")}
            </h3>
            <div id={linksId} className="mt-3 flex flex-wrap gap-2">
              {visibleUrls.map((urlEntry) => (
                <a
                  key={`${infobox.id}-${urlEntry.url}`}
                  href={urlEntry.url}
                  target={openInNewTab ? "_blank" : undefined}
                  rel={openInNewTab ? "noreferrer noopener" : undefined}
                  className="rounded-full border border-[var(--surface-chip-border)] px-3 py-1.5 text-[13px] text-primary transition-colors hover:bg-accent hover:text-foreground"
                >
                  {urlEntry.title}
                </a>
              ))}
            </div>

            {hiddenUrlCount ? (
              <button
                type="button"
                aria-controls={linksId}
                aria-expanded={areLinksExpanded}
                className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                onClick={() => setAreLinksExpanded((expanded) => !expanded)}
              >
                {areLinksExpanded
                  ? t("showFewerLinks")
                  : t("showMoreLinks", { count: hiddenUrlCount })}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform",
                    areLinksExpanded && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </section>
        ) : null}

        {infobox.relatedTopics.length ? (
          <section className="border-t border-[var(--surface-separator)] px-5 py-5 sm:px-6">
            <div id={relatedTopicsId} className="space-y-4">
              {visibleRelatedTopics.map((topic) => (
                <div key={`${infobox.id}-${topic.name}`} className="space-y-2.5">
                  <h3 className="text-[12px] font-medium text-[var(--text-soft)]">
                    {topic.name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {topic.suggestions.map((suggestion) => (
                      <Link
                        key={`${topic.name}-${suggestion}`}
                        href={buildHref(pathname, searchParams, {
                          q: suggestion,
                          page: null,
                        })}
                        className="rounded-full border border-[var(--surface-chip-border)] px-3 py-1.5 text-[13px] text-[var(--text-body)] transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {suggestion}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {relatedTopicsHaveOverflow ? (
              <button
                type="button"
                aria-controls={relatedTopicsId}
                aria-expanded={areRelatedTopicsExpanded}
                className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                onClick={() =>
                  setAreRelatedTopicsExpanded((expanded) => !expanded)
                }
              >
                {areRelatedTopicsExpanded
                  ? t("showFewerRelated")
                  : t("showMoreRelated")}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform",
                    areRelatedTopicsExpanded && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
