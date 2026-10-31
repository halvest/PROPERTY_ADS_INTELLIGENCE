import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { dataDeletion } from "@/lib/legal/documents";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("app_locale")?.value === "en" ? "en" : "id";
  return {
    title: dataDeletion.title[locale],
    description: dataDeletion.description[locale],
    alternates: { canonical: "/data-deletion" },
  };
}

export default function DataDeletionPage() {
  return <LegalPageLayout document={dataDeletion} currentPath="/data-deletion" />;
}
