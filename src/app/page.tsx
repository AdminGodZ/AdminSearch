import Image from "next/image";

import { SearchForm } from "@/components/search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SpecialText } from "@/components/special-text";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="w-full px-6 pt-6 sm:px-8 lg:px-10">
        <SiteHeader />
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 sm:px-8 lg:px-10">
        <section className="flex flex-1 flex-col items-center justify-start pt-18 pb-8">
          <div className="flex w-full max-w-4xl flex-col items-center">
            <div className="relative size-40 select-none sm:size-44">
              <Image
                src="/AdminGod_white.png"
                alt="AdminSearch logo"
                fill
                className="object-contain"
                sizes="176px"
                priority
              />
            </div>

            <h1 className="mt-6 select-none text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              <SpecialText speed={22} delay={0.1} className="leading-none">
                AdminSearch
              </SpecialText>
            </h1>

            <div className="mt-12 w-full max-w-3xl">
              <SearchForm
                action="/search"
                defaultQuery=""
                tab="all"
                size="hero"
                variant="landing"
                placeholder="Search AdminSearch"
              />
            </div>
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
