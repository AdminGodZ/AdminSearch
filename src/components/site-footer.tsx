import Link from "next/link";

const footerLinks = [
  { href: "/", label: "AdminSearch" },
  { href: "/search?q=adminsearch+user+manual&tab=all", label: "User Manual" },
  { href: "/search?q=adminsearch+process+map&tab=all", label: "Process Map" },
  { href: "/search?q=adminsearch+faq&tab=all", label: "FAQ" },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#f2f2f2]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-6 text-sm text-foreground/85">
        {footerLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="transition-colors hover:text-primary"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
