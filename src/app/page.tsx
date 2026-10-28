import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CpqlCalculator } from "@/components/landing/CpqlCalculator";
import { WorkflowSection, SecuritySection } from "@/components/landing/WorkflowSecurity";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { ClosingCta, LandingFooter } from "@/components/landing/ClosingFooter";
import { idDictionary } from "@/lib/i18n/dictionaries/id";
import { enDictionary } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/types";

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return cookieStore.get("app_locale")?.value === "en" ? "en" : "id";
}

function getDict(locale: Locale) {
  return locale === "en" ? enDictionary : idDictionary;
}

/**
 * SEO choice (single URL + cookie locale): the app resolves language from the
 * app_locale cookie on the server, so "/" always serves one canonical URL.
 * We therefore do NOT emit hreflang alternates — there are no separate
 * /id or /en URLs with distinct server content to point them at.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { landing } = getDict(locale);
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    metadataBase: new URL(base),
    title: landing.meta.title,
    description: landing.meta.description,
    alternates: { canonical: "/" },
    openGraph: {
      title: landing.meta.title,
      description: landing.meta.description,
      url: "/",
      siteName: "HD Creative",
      locale: locale === "id" ? "id_ID" : "en_US",
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: landing.meta.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: landing.meta.title,
      description: landing.meta.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function HomePage() {
  const locale = await getLocale();
  const dict = getDict(locale);
  const landing = dict.landing;
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // JSON-LD contains only verifiable facts: no offers (no public pricing),
  // no sameAs (no public profiles), FAQ identical to the visible FAQ.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "HD Creative",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        url: `${base}/`,
        description: landing.meta.description,
      },
      {
        "@type": "Organization",
        name: "HD Creative",
        alternateName: "Haspro Digital Creative",
        url: `${base}/`,
        logo: `${base}/logo.png`,
      },
      {
        "@type": "FAQPage",
        mainEntity: landing.faq.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingNavbar landing={landing} />
      <main className="flex-1">
        <HeroSection landing={landing} locale={locale} />
        <ProblemSection landing={landing} />
        <FeaturesSection landing={landing} />
        <CpqlCalculator landing={landing} locale={locale} />
        <WorkflowSection landing={landing} />
        <SecuritySection landing={landing} />
        <FaqAccordion landing={landing} />
        <ClosingCta landing={landing} />
      </main>
      <LandingFooter landing={landing} />
    </div>
  );
}
