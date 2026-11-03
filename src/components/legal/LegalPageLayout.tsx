"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { NavbarActions } from "@/components/landing/NavbarActions";
import { useI18n } from "@/lib/i18n/I18nProvider";

export interface LegalText {
  id: string;
  en: string;
}

export interface LegalSection {
  heading: LegalText;
  paragraphs?: LegalText[];
  lists?: Array<{ ordered?: boolean; items: LegalText[] }>;
}

export interface LegalDocument {
  title: LegalText;
  description: LegalText;
  sections: LegalSection[];
}

const pageLinks = [
  { href: "/privacy-policy", id: "Kebijakan Privasi", en: "Privacy Policy" },
  { href: "/terms-of-service", id: "Ketentuan Layanan", en: "Terms of Service" },
  { href: "/data-deletion", id: "Penghapusan Data", en: "Data Deletion" },
];

export function LegalPageLayout({ document, currentPath }: { document: LegalDocument; currentPath: string }) {
  const { locale, dict } = useI18n();
  const language = locale === "id" ? "id" : "en";
  const title = document.title[language];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="HD Creative — Home">
            <BrandLogo size="sm" priority />
            <span className="text-sm font-semibold tracking-tight">HD Creative</span>
          </Link>
          <nav aria-label={locale === "id" ? "Navigasi utama" : "Main navigation"} className="order-3 flex w-full gap-1 overflow-x-auto pb-1 text-sm sm:order-2 sm:w-auto sm:pb-0">
            <Link href="/" className="shrink-0 rounded-lg px-3 py-2 text-muted hover:bg-accent/5 hover:text-foreground">
              {locale === "id" ? "Beranda" : "Home"}
            </Link>
            {pageLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.href === currentPath ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 hover:bg-accent/5 hover:text-foreground ${link.href === currentPath ? "font-semibold text-foreground" : "text-muted"}`}
              >
                {locale === "id" ? link.id : link.en}
              </Link>
            ))}
          </nav>
          <div className="order-2 flex items-center gap-2 sm:order-3">
            <NavbarActions />
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-foreground sm:inline-flex">
              {dict.common.login}
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <article className="mx-auto max-w-3xl">
          <header className="mb-10 border-b border-line pb-7">
            <p className="text-sm font-medium text-accent">{locale === "id" ? "HD Creative · Legal" : "HD Creative · Legal"}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 text-base leading-7 text-muted">{document.description[language]}</p>
            <p className="mt-3 text-sm text-muted">
              {locale === "id" ? "Berlaku mulai 29 Oktober 2026" : "Effective 29 October 2026"}
            </p>
          </header>

          <div className="space-y-8 text-[15px] leading-7 text-muted [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_ol]:space-y-1 [&_ul]:space-y-1">
            {document.sections.map((section, index) => (
              <section key={`${section.heading[language]}-${index}`}>
                <h2>{section.heading[language]}</h2>
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className={paragraphIndex > 0 ? "mt-3" : undefined}>
                    {paragraph[language]}
                  </p>
                ))}
                {section.lists?.map((list, listIndex) => {
                  const List = list.ordered ? "ol" : "ul";
                  return (
                    <List key={listIndex} className="mt-3">
                      {list.items.map((item, itemIndex) => <li key={itemIndex}>{item[language]}</li>)}
                    </List>
                  );
                })}
              </section>
            ))}
          </div>
        </article>
      </main>

      <footer className="border-t border-line/60 bg-subtle/30">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandLogo size="sm" />
              <span className="font-semibold">HD Creative</span>
            </Link>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              {locale === "id"
                ? "Intelijen pemasaran properti dari Haspro Digital Creative."
                : "Property marketing intelligence by Haspro Digital Creative."}
            </p>
          </div>
          <nav aria-label={locale === "id" ? "Dokumen legal" : "Legal documents"} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {pageLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted hover:text-accent">
                {locale === "id" ? link.id : link.en}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-line/70 px-4 py-4 text-center text-xs text-muted">
          © 2026 HD Creative. {locale === "id" ? "Seluruh hak cipta dilindungi." : "All rights reserved."}
        </div>
      </footer>
    </div>
  );
}
