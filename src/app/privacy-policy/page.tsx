import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { privacyPolicy } from "@/lib/legal/documents";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("app_locale")?.value === "en" ? "en" : "id";
  return {
    title: privacyPolicy.title[locale],
    description: privacyPolicy.description[locale],
    alternates: { canonical: "/privacy-policy" },
  };
}

export default function PrivacyPolicyPage() {
  return <LegalPageLayout document={privacyPolicy} currentPath="/privacy-policy" />;
}
