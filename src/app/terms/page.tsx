import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { termsOfService } from "@/lib/legal/documents";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("app_locale")?.value === "en" ? "en" : "id";
  return {
    title: `${termsOfService.title[locale]} | Haspro (hdcreative.cloud)`,
    description: termsOfService.description[locale],
    alternates: { canonical: "/terms" },
  };
}

export default function TermsPage() {
  return <LegalPageLayout document={termsOfService} currentPath="/terms" />;
}
