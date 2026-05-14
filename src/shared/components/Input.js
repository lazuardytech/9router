"use client";

import { cn } from "@/shared/utils/cn";

export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className,
  inputClassName,
  ...props
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-[12px] font-[510] text-storm-cloud tracking-[-0.1px]">
          {label}
          {required && <span className="text-warning-red ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-storm-cloud">
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "w-full py-2.5 px-3.5 text-[13px] text-porcelain bg-gunmetal",
            "rounded-[6px] border border-charcoal-grey",
            "placeholder:text-fog-grey",
            "focus:outline-none focus:border-neon-lime/50 focus:ring-1 focus:ring-neon-lime/25",
            "transition-colors duration-100",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "text-[16px] sm:text-[13px]",
            icon && "pl-9",
            error && "border-warning-red focus:border-warning-red focus:ring-warning-red/25",
            inputClassName,
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[11px] text-warning-red flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">error</span>
          {error}
        </p>
      )}
      {hint && !error && <p className="text-[11px] text-fog-grey">{hint}</p>}
    </div>
  );
}
