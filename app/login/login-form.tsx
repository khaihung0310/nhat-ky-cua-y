"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm({ next, disabled }: { next: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">{t.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <div>
        <Label htmlFor="password">{t.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      {state.error && (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={pending || disabled} aria-busy={pending}>
        <LogIn aria-hidden />
        {pending ? t.auth.signingIn : t.auth.signIn}
      </Button>
    </form>
  );
}
