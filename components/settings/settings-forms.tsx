"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { changePassword, updateDisplayName } from "@/app/actions/profile";
import { logout, setTheme } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { DISPLAY_NAME_MAX, PASSWORD_MIN } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function DisplayNameForm({ initial }: { initial: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateDisplayName(name).catch(() => ({ ok: false as const, error: t.errors.offline }));
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          toast(t.settings.profileSaved);
          router.refresh();
        });
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <Label htmlFor="display-name">{t.settings.displayName}</Label>
        <Input
          id="display-name"
          value={name}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "display-name-error" : undefined}
          autoComplete="nickname"
        />
        <FieldError id="display-name-error">{error}</FieldError>
      </div>
      <Button type="submit" disabled={pending || name.trim() === initial}>
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const { t } = useI18n();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changePassword(pw, confirm).catch(() => ({ ok: false as const, error: t.errors.offline }));
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          setPw("");
          setConfirm("");
          toast(t.settings.passwordSaved);
        });
      }}
      className="space-y-4"
    >
      {/* hidden username field helps password managers */}
      <input type="text" name="username" autoComplete="username" className="hidden" readOnly tabIndex={-1} aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="new-password">{t.settings.newPassword}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "password-error" : "password-hint"}
          />
          <FieldHint id="password-hint">{t.settings.passwordHint}</FieldHint>
        </div>
        <div>
          <Label htmlFor="confirm-password">{t.settings.confirmPassword}</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "password-error" : undefined}
          />
        </div>
      </div>
      <FieldError id="password-error">{error}</FieldError>
      <Button type="submit" variant="outline" disabled={pending || !pw}>
        <KeyRound aria-hidden />
        {pending ? t.common.saving : t.settings.password}
      </Button>
    </form>
  );
}

export function ThemePicker({ initial }: { initial: "light" | "dark" | "system" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [, start] = useTransition();

  const apply = (theme: "light" | "dark" | "system") => {
    setValue(theme);
    const root = document.documentElement;
    root.dataset.theme = theme;
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    start(async () => {
      await setTheme(theme);
      router.refresh();
    });
  };

  const options = [
    { key: "light", label: t.settings.themeLight, icon: Sun },
    { key: "dark", label: t.settings.themeDark, icon: Moon },
    { key: "system", label: t.settings.themeSystem, icon: Monitor },
  ] as const;

  return (
    <div role="radiogroup" aria-label={t.settings.theme} className="inline-flex flex-wrap gap-2">
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => apply(key)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
            value === key ? "border-tulip-ink bg-tulip-soft text-tulip-ink" : "border-line bg-sheet text-ink-soft hover:text-ink",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

export function LogoutButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" onClick={() => start(() => logout())} disabled={pending}>
      <LogOut aria-hidden />
      {t.settings.logout}
    </Button>
  );
}
