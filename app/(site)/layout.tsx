import Link from "next/link";
import { CookieBanner } from "@/components/CookieBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SITE_NAME } from "@/lib/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-md bg-brand text-sm font-bold text-brand-fg"
            >
              П
            </span>
            {SITE_NAME}
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/search" className="rounded-md px-3 py-2 text-muted hover:bg-surface-2 hover:text-fg">
              Поиск
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-line bg-surface text-sm text-muted">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-4 py-5">
          <span>
            © {new Date().getFullYear()} {SITE_NAME}
          </span>
          <Link href="/about" className="hover:text-fg">
            О проекте
          </Link>
          <Link href="/privacy" className="hover:text-fg">
            Конфиденциальность
          </Link>
          <Link href="/search" className="hover:text-fg">
            Поиск вопросов
          </Link>
        </div>
      </footer>
      <CookieBanner />
    </div>
  );
}
