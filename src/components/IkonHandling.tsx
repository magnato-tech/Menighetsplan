import React from "react";
import { Check, type LucideIcon } from "lucide-react";

const BASE =
  "inline-flex items-center justify-center shrink-0 rounded-md border transition cursor-pointer";

type Variant = "default" | "sky" | "confirm" | "wait" | "decline";

const VARIANTS: Record<Variant, string> = {
  default: "border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-white",
  sky: "bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800",
  confirm:
    "border-slate-200 text-slate-500 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200",
  wait: "border-slate-200 text-slate-500 bg-white hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200",
  decline:
    "border-slate-200 text-slate-500 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200",
};

interface IkonHandlingProps {
  label: string;
  Icon: LucideIcon;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  copied?: boolean;
  active?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: "sm" | "md";
}

export const IkonHandling: React.FC<IkonHandlingProps> = ({
  label,
  Icon,
  onClick,
  copied = false,
  active = false,
  disabled = false,
  variant = "default",
  size = "sm",
}) => {
  const dim =
    size === "md"
      ? "p-2.5 min-h-11 min-w-11 md:p-2 md:min-h-0 md:min-w-0"
      : "p-2 min-h-11 min-w-11 md:p-1.5 md:min-h-0 md:min-w-0";
  const iconDim = size === "md" ? "w-5 h-5 md:w-4 md:h-4" : "w-4 h-4 md:w-3.5 md:h-3.5";
  const visLabel = copied ? `${label} kopiert` : label;

  let farger = copied ? "bg-emerald-50 border-emerald-300 text-emerald-700" : VARIANTS[variant];
  if (active && variant === "confirm") {
    farger = "bg-emerald-600 border-emerald-600 text-white";
  } else if (active && variant === "wait") {
    farger = "bg-amber-500 border-amber-500 text-white";
  } else if (active && variant === "decline") {
    farger = "bg-rose-600 border-rose-600 text-white";
  }
  if (disabled) {
    farger = "border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed";
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick(e);
      }}
      disabled={disabled}
      title={visLabel}
      aria-label={visLabel}
      className={`${BASE} ${dim} ${farger} ${disabled ? "cursor-not-allowed" : ""}`}
    >
      {copied ? (
        <Check className={`${iconDim} text-emerald-600`} />
      ) : (
        <Icon className={iconDim} />
      )}
    </button>
  );
};
