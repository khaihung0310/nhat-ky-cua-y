import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-2xl border border-line bg-sheet px-4 text-ink placeholder:text-ink-soft/70 transition-colors focus-visible:border-tulip-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-[invalid=true]:border-danger disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(control, "py-3", className)} {...props} />;
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-danger">
      {children}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-ink-soft">
      {children}
    </p>
  );
}
