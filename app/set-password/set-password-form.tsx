"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { setInitialPassword, type SetPasswordState } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/client";
import { PASSWORD_MIN } from "@/lib/validation";

export function SetPasswordForm({ email }: { email: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setInitialPassword, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {/* lets password managers save the new password against the right account */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div>
        <Label htmlFor="password">{t.settings.newPassword}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "set-pw-error" : "set-pw-hint"}
        />
        <FieldHint id="set-pw-hint">{t.settings.passwordHint}</FieldHint>
      </div>
      <div>
        <Label htmlFor="confirm">{t.settings.confirmPassword}</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "set-pw-error" : undefined}
        />
      </div>
      <FieldError id="set-pw-error">{state.error}</FieldError>
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
        <KeyRound aria-hidden />
        {pending ? t.common.saving : t.auth.setPasswordButton}
      </Button>
    </form>
  );
}
