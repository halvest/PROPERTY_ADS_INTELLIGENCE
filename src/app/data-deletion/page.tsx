import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { dataDeletion } from "@/lib/legal/documents";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("app_locale")?.value === "en" ? "en" : "id";
  return {
    title: `${dataDeletion.title[locale]} | Haspro (hdcreative.cloud)`,
    description: dataDeletion.description[locale],
    alternates: { canonical: "/data-deletion" },
  };
}

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const resolved = await searchParams;
  const confirmationCode = typeof resolved?.code === "string" ? resolved.code.trim() : undefined;

  return (
    <LegalPageLayout
      document={dataDeletion}
      currentPath="/data-deletion"
      confirmationCode={confirmationCode}
    />
  );
}
