import type { LongevityPhase } from "./types";

export interface LongevityCalculation {
  active_days_count: number;
  longevity_phase: LongevityPhase;
  is_scaling: boolean;
  phase_label: string;
  badge_color: string;
}

export function calculateAdLongevity(params: {
  start_date: string | Date;
  end_date?: string | Date | null;
  is_active?: boolean;
  collation_count?: number;
}): LongevityCalculation {
  const start = new Date(params.start_date);
  const now = new Date();
  const end = params.is_active || !params.end_date ? now : new Date(params.end_date);

  // Milliseconds to days
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const active_days_count = Math.max(1, diffDays);

  let longevity_phase: LongevityPhase = "TESTING";
  let phase_label = "Testing (Eksplorasi)";
  let badge_color = "zinc";

  if (active_days_count >= 15) {
    longevity_phase = "EVERGREEN";
    phase_label = "Evergreen Winner";
    badge_color = "emerald";
  } else if (active_days_count >= 5) {
    longevity_phase = "VALIDATING";
    phase_label = "Validating (Stabil)";
    badge_color = "blue";
  }

  const is_scaling = (params.collation_count ?? 1) >= 3;

  return {
    active_days_count,
    longevity_phase,
    is_scaling,
    phase_label,
    badge_color,
  };
}
