import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-tulip-ink text-white hover:bg-tulip-ink/90 dark:text-paper",
        soft: "bg-tulip-soft text-tulip-ink hover:bg-tulip-soft/70",
        outline: "border border-line bg-sheet text-ink hover:bg-paper-deep",
        ghost: "text-ink-soft hover:bg-paper-deep hover:text-ink",
        danger: "bg-danger text-white hover:bg-danger/90 dark:text-paper",
        link: "text-tulip-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-full px-3.5 text-sm",
        md: "h-11 rounded-full px-5 text-[0.95rem]",
        lg: "h-12 rounded-full px-6 text-base",
        icon: "size-10 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
