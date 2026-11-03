import React, { Suspense } from "react";
import { LeadDetailClient } from "./LeadDetailClient";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-zinc-500">
          Memuat data prospek...
        </div>
      }
    >
      <LeadDetailClient leadId={id} />
    </Suspense>
  );
}
