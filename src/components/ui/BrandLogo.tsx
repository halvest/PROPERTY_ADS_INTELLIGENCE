import React from "react";
import Image from "next/image";

export interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
}

const sizeMap = {
  xs: { px: 20, cls: "h-5 w-5" },
  sm: { px: 28, cls: "h-7 w-7" },
  md: { px: 36, cls: "h-9 w-9" },
  lg: { px: 44, cls: "h-11 w-11" },
  xl: { px: 56, cls: "h-14 w-14" },
};

const roundedMap = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

/**
 * Standardized BrandLogo component sourcing solely from `public/logo.png`.
 * Maintains genuine 1:1 aspect ratio across all viewports and theme modes.
 */
export function BrandLogo({
  size = "md",
  className = "",
  priority = false,
  rounded = "lg",
}: BrandLogoProps) {
  const { px, cls } = sizeMap[size] || sizeMap.md;
  const roundedClass = roundedMap[rounded] || roundedMap.lg;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden ${cls} ${roundedClass} ${className}`}
    >
      <Image
        src="/logo.png"
        alt="HD Creative"
        width={px}
        height={px}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
