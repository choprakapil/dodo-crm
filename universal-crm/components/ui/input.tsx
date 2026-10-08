import * as React from "react";
import { cn } from "cn";

export interface InputProps extends React.ComponentProps<"input"> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        value={value !== undefined ? value : (props.defaultValue !== undefined ? undefined : "")}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:ring-1 focus-visible:ring-indigo-600 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 aria-invalid:border-rose-500",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
