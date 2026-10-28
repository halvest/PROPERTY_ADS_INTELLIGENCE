import React, { Suspense } from "react";
import { SYNTHETIC_LEAD_SCENARIOS } from "@/fixtures/synthetic-leads";
import { LeadDetailClient } from "./LeadDetailClient";

export function generateStaticParams() {
  return Object.values(SYNTHETIC_LEAD_SCENARIOS).map((sc) => ({
    id: sc.id,
  }));
}

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
