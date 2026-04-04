import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { SpecialText } from "@/components/site/special-text";
import { ThemeLogo } from "@/components/site/theme-logo";
import { SearchForm } from "@/features/search/components/search-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex w-full justify-end pt-6 pl-6 pr-6 sm:pl-8 sm:pr-6 lg:pl-10 lg:pr-6">
        <Header className="w-auto" />
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 sm:px-8 lg:px-10">
        <section className="flex flex-1 flex-col items-center justify-start pt-18 pb-8">
          <div className="flex w-full max-w-4xl flex-col items-center">
            <div className="relative size-40 select-none sm:size-44">
              <ThemeLogo className="object-contain" sizes="176px" priority />
            </div>

            <h1 className="mt-4 select-none text-4xl leading-none font-semibold tracking-tight text-foreground sm:text-5xl">
              <SpecialText speed={22} delay={0.1} className="leading-none">
                AdminSearch
              </SpecialText>
            </h1>

            <div className="mt-8 w-full max-w-3xl">
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

      <Footer />
    </main>
  );
}
