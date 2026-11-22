import type { ReactNode, Ref } from "react";

export type SettingsSection =
  | "profile"
  | "whatsapp"
  | "meta"
  | "subscription"
  | "security";

export type SettingsTone = "neutral" | "good" | "warn" | "bad" | "info";

export type SettingsNavItem = {
  id: SettingsSection;
  label: string;
};

export const fieldClassName =
  "h-10 w-full rounded-lg border border-zinc-200/90 bg-white px-3.5 text-[13.5px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 dark:border-zinc-700/90 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 dark:disabled:bg-zinc-900";

/**
 * Horizontal Segmented Pill Tab Bar — Modern Solar theme, Light & Dark compatible.
 */
export function SettingsNavigation({
  items,
  active,
  onSelect,
  label,
}: {
  items: SettingsNavItem[];
  active: SettingsSection;
  onSelect: (id: SettingsSection) => void;
  label: string;
}) {
  return (
    <div
      className="mb-6 flex w-full flex-wrap gap-1 rounded-2xl border border-zinc-200/80 bg-zinc-100/90 p-1 dark:border-white/[0.08] dark:bg-zinc-950/70"
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(item.id)}
            className={`min-w-[8.5rem] flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-[13px] transition-all cursor-pointer sm:px-4 ${
              selected
                ? "bg-white font-semibold text-zinc-950 shadow-xs ring-1 ring-indigo-400/70 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-indigo-400/50"
                : "font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionIntro({
  title,
  description,
  actions,
  headingRef,
}: {
  category?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight text-zinc-950 outline-none dark:text-zinc-50"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">{actions}</div> : null}
    </header>
  );
}

export function NoticeBanner({
  kind,
  text,
  onDismiss,
  dismissLabel,
}: {
  kind: "success" | "error";
  text: string;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  const success = kind === "success";
  return (
    <div
      role="status"
      className={`mb-6 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] ${
        success
          ? "border-emerald-200/90 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-rose-200/90 bg-rose-50/90 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {success ? (
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        )}
        <p className="leading-5">{text}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-current opacity-65 transition-opacity hover:opacity-100 cursor-pointer"
        aria-label={dismissLabel}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`divide-y divide-zinc-200/60 dark:divide-zinc-800/80 ${className}`}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{title}</h2>
          {badge}
        </div>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SettingRow({
  label,
  hint,
  htmlFor,
  badge,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 py-5 xl:grid-cols-[minmax(12rem,17rem)_minmax(0,1fr)] xl:items-start xl:gap-10">
      <div className="pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {htmlFor ? (
            <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100">
              {label}
            </label>
          ) : (
            <p className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
          )}
          {badge}
        </div>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      </div>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </div>
  );
}

export function PanelFooter({
  hint,
  children,
}: {
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
      <div className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
      {children ? <div className="flex shrink-0 items-center gap-2.5">{children}</div> : null}
    </div>
  );
}

export function StatusPill({
  tone,
  dot = false,
  children,
}: {
  tone: SettingsTone;
  dot?: boolean;
  children: ReactNode;
}) {
  const tones: Record<SettingsTone, string> = {
    neutral:
      "border-zinc-200/90 bg-zinc-100/80 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    good:
      "border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    warn:
      "border-indigo-200/90 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300",
    bad:
      "border-rose-200/90 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
    info:
      "border-indigo-200/90 bg-indigo-50/70 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/30 dark:text-indigo-300",
  };
  const dots: Record<SettingsTone, string> = {
    neutral: "bg-zinc-400 dark:bg-zinc-500",
    good: "bg-emerald-500",
    warn: "bg-indigo-500",
    bad: "bg-rose-500",
    info: "bg-indigo-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]}`}
    >
      {dot ? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} /> : null}
      {children}
    </span>
  );
}
