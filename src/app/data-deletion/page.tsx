import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { dataDeletion } from "@/lib/legal/documents";
import { lookupMetaDataDeletion } from "@/lib/meta/meta-data-deletion";

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
  const locale = (await cookies()).get("app_locale")?.value === "en" ? "en" : "id";
  let statusNote: string | undefined;
  if (confirmationCode) {
    try {
      const status = await lookupMetaDataDeletion(confirmationCode);
      if (status.found && status.outcome === "not_found") {
        statusNote = locale === "id"
          ? "Permintaan penghapusan tercatat. Tidak ada data Meta yang cocok dengan pengguna ini, jadi tidak ada data yang dihapus."
          : "The deletion request was recorded. No Meta data matched this user, so nothing was deleted.";
      } else if (status.found && status.outcome === "completed") {
        statusNote = locale === "id"
          ? `Data Meta untuk pengguna ini dihapus. Token iklan: ${status.adsTokensRevoked}. Nomor WhatsApp: ${status.whatsappTokensRevoked}. Percakapan: ${status.conversationsDeleted}. Pesan: ${status.messagesDeleted}.`
          : `Meta data for this user was deleted. Ad tokens: ${status.adsTokensRevoked}. WhatsApp numbers: ${status.whatsappTokensRevoked}. Conversations: ${status.conversationsDeleted}. Messages: ${status.messagesDeleted}.`;
      } else if (status.found) {
        statusNote = locale === "id"
          ? "Kode ini tercatat, tetapi hasil penghapusannya belum bisa diklasifikasi. Simpan kode dan hubungi support@hdcreative.cloud."
          : "This code is recorded, but the deletion result could not be classified. Keep the code and contact support@hdcreative.cloud.";
      } else {
        statusNote = locale === "id"
          ? "Tidak ada permintaan penghapusan untuk kode ini."
          : "No deletion request matches this code.";
      }
    } catch {
      statusNote = locale === "id"
        ? "Status penghapusan belum dapat dibaca. Simpan kode ini dan hubungi support@hdcreative.cloud."
        : "Deletion status could not be read. Keep this code and contact support@hdcreative.cloud.";
    }
  }

  return (
    <LegalPageLayout
      document={dataDeletion}
      currentPath="/data-deletion"
      confirmationCode={confirmationCode}
      statusNote={statusNote}
    />
  );
}
