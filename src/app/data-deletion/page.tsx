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
      if (status.found) {
        statusNote = locale === "id"
          ? `Token Meta untuk pengguna ini sudah dihapus. Koneksi iklan yang dicabut: ${status.adsTokensRevoked}. Nomor WhatsApp yang diputus: ${status.whatsappTokensRevoked}.`
          : `Meta tokens for this user were deleted. Ad connections revoked: ${status.adsTokensRevoked}. WhatsApp numbers disconnected: ${status.whatsappTokensRevoked}.`;
      } else {
        statusNote = locale === "id"
          ? "Tidak ada token iklan atau WhatsApp yang tersimpan untuk kode ini. Jika koneksi dibuat sebelum ID Facebook dicatat, kirim kode ini ke support@hdcreative.cloud. Data workspace yang diunggah sendiri dihapus dalam 7 hari kerja setelah kepemilikan diverifikasi."
          : "No stored ad or WhatsApp token matches this code. If the connection predates Facebook user id recording, send this code to support@hdcreative.cloud. Workspace-uploaded records are deleted within 7 business days after ownership is verified.";
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
