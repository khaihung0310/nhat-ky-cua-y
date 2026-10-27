"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: Tone };

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const reduce = useReducedMotion();

  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? CircleAlert : Info;
            return (
              <motion.div
                key={t.id}
                role={t.tone === "error" ? "alert" : "status"}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-soft",
                  t.tone === "success" && "border-sage/50 bg-sage-soft text-sage-ink",
                  t.tone === "error" && "border-danger/40 bg-danger-soft text-danger",
                  t.tone === "info" && "border-lavender/50 bg-lavender-soft text-lavender-ink",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
