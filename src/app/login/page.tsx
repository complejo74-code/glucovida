"use client";

import { useState, Suspense } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signIn, signUp } from "./actions";

type Mode = "login" | "register";

/**
 * Botón de submit con feedback de carga (ver edge case de la spec 10b1): usa
 * useFormStatus para deshabilitarse y mostrar un spinner mientras la Server
 * Action autentica. No toca la lógica de auth — solo refleja su estado pending.
 */
function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  const label = mode === "login" ? "Ingresar" : "Crear cuenta";
  const pendingLabel = mode === "login" ? "Ingresando…" : "Creando tu cuenta…";

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && (
        <span
          aria-hidden
          className="inline-block size-4 animate-spin rounded-circle border-2 border-white/40 border-t-white"
        />
      )}
      {pending ? pendingLabel : label}
    </Button>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const params = useSearchParams();
  const error = params.get("error");
  const mensaje = params.get("mensaje");

  // Tono del branding (docs/BRANDING.md §9): jamás un error crudo de Supabase.
  // Las Server Actions ya redirigen con códigos fijos; acá los traducimos a
  // texto cálido, y cualquier código no contemplado cae en un fallback amable.
  const errorTexts: Record<string, string> = {
    credenciales_invalidas:
      "Ese email o esa contraseña no coinciden. ¿Probamos de nuevo?",
    registro_fallido:
      "No pudimos crear tu cuenta con ese email. ¿Probás con otro?",
  };
  const mensajeTexts: Record<string, string> = {
    revisa_tu_email:
      "¡Listo! Te mandamos un email de confirmación. Revisá tu bandeja.",
  };

  const heading =
    mode === "login" ? "Qué bueno verte de nuevo" : "Bienvenido a tu lugar";
  const subheading =
    mode === "login"
      ? "Ingresá para volver a tu espacio."
      : "Creá tu cuenta y empecemos juntos.";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-section px-4 py-12">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-circle bg-primary-air text-3xl">
          🩵
        </div>
        <h1 className="text-3xl font-black leading-title text-text">
          GlucoVida
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tu espacio de convivencia con la diabetes
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-card border border-border bg-white p-7 shadow-card-hover">
        {/* Toggle Ingresar / Registrarme (pill) */}
        <div className="mb-6 flex rounded-pill bg-primary-air p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "min-h-11 flex-1 rounded-pill text-sm font-bold transition-all",
                mode === m
                  ? "bg-gradient-primary text-primary-foreground shadow-btn-hover"
                  : "text-muted hover:text-text"
              )}
            >
              {m === "login" ? "Ingresar" : "Registrarme"}
            </button>
          ))}
        </div>

        {/* Encabezado cálido */}
        <div className="mb-6">
          <h2 className="text-xl font-extrabold leading-title text-text">
            {heading}
          </h2>
          <p className="mt-1 text-sm leading-body text-muted">{subheading}</p>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-4 rounded-input border border-danger bg-danger/5 px-4 py-3 text-sm text-danger">
            {errorTexts[error] ??
              "Algo no salió como esperábamos. ¿Probamos de nuevo?"}
          </div>
        )}
        {mensaje && (
          <div className="mb-4 rounded-input border border-success bg-success/5 px-4 py-3 text-sm text-success">
            {mensajeTexts[mensaje] ?? mensaje}
          </div>
        )}

        {/* Form — misma lógica: la action depende del modo */}
        <form action={mode === "login" ? signIn : signUp} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-text"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vos@ejemplo.com"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-text"
            >
              Contraseña
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={
                mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"
              }
              minLength={mode === "register" ? 8 : undefined}
            />
          </div>

          <div className="pt-2">
            <SubmitButton mode={mode} />
          </div>
        </form>
      </div>

      <p className="mt-6 max-w-sm text-center text-xs leading-body text-muted">
        GlucoVida acompaña y educa, no reemplaza a tu equipo médico.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
