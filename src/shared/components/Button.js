"use client";

import { cn } from "@/shared/utils/cn";

const variants = {
  primary:
    "bg-neon-lime hover:bg-[#d4e010] text-pitch-black font-[590] shadow-[var(--shadow-sm)] disabled:opacity-40 disabled:cursor-not-allowed btn-cta",
  secondary:
    "bg-gunmetal hover:bg-charcoal-grey text-porcelain border border-charcoal-grey hover:border-muted-ash disabled:opacity-40 disabled:cursor-not-allowed",
  outline:
    "border border-charcoal-grey text-light-steel hover:bg-deep-slate hover:border-muted-ash disabled:opacity-40 disabled:cursor-not-allowed",
  ghost: "text-storm-cloud hover:bg-deep-slate hover:text-porcelain disabled:opacity-40 disabled:cursor-not-allowed",
  danger:
    "bg-warning-red hover:bg-[#d94f4f] text-porcelain shadow-[var(--shadow-sm)] disabled:opacity-40 disabled:cursor-not-allowed",
  success:
    "bg-emerald hover:bg-[#1f8a38] text-porcelain shadow-[var(--shadow-sm)] disabled:opacity-40 disabled:cursor-not-allowed",
};

const sizes = {
  sm: "h-7 px-3 text-[12px] gap-1.5 rounded-[6px]",
  md: "h-8 px-3.5 text-[13px] gap-2 rounded-[6px]",
  lg: "h-9 px-4 text-[13px] gap-2 rounded-[6px]",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-[400] transition-all duration-100 ease-out cursor-pointer",
        "active:scale-[0.97] disabled:active:scale-100",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && <span className="material-symbols-outlined text-[16px]">{iconRight}</span>}
    </button>
  );
}
