"use client";

import { useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BookHeart } from "lucide-react";
import { completeOnboarding } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { TulipMark } from "@/components/layout/tulip-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

/**
 * The one orchestrated moment of the app: the lines of the welcome letter
 * appear one after another, like being written.
 */
export function WelcomeScreen({ lines, cta }: { lines: string[]; cta: string }) {
  const reduce = useReducedMotion();
  const [pending, start] = useTransition();
  const delay = (i: number) => (reduce ? 0 : 0.5 + i * 0.9);

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="margin-line w-full max-w-xl rounded-[2rem] border border-line bg-sheet px-7 py-12 pl-10 shadow-soft sm:px-12 sm:pl-16">
        <motion.div initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
          <TulipMark className="mb-8 size-16" />
        </motion.div>
        <div className="space-y-5 font-serif">
          {lines.map((line, i) => (
            <motion.p
              key={line}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay(i), duration: 0.8, ease: "easeOut" }}
              className={i === 0 ? "text-3xl leading-snug sm:text-4xl" : "text-lg leading-relaxed text-ink-soft sm:text-xl"}
            >
              {line}
            </motion.p>
          ))}
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay(lines.length), duration: 0.6 }}
          className="mt-10"
        >
          <Button size="lg" onClick={() => start(() => completeOnboarding())} disabled={pending} aria-busy={pending}>
            <BookHeart aria-hidden />
            {cta}
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
