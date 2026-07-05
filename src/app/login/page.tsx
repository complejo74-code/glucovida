"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp } from "./actions";

function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const params = useSearchParams();
  const error = params.get("error");
  const mensaje = params.get("mensaje");

  const errorTexts: Record<string, string> = {
    credenciales_invalidas: "Email o contraseña incorrectos. Intentá de nuevo.",
    registro_fallido: "No pudimos crear tu cuenta. Intentá con otro email.",
  };

  const mensajeTexts: Record<string, string> = {
    revisa_tu_email:
      "¡Listo! Te mandamos un email de confirmación. Revisá tu bandeja.",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      {/* Logo / Brand */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: "#D6EEFB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            margin: "0 auto 12px",
          }}
        >
          🩵
        </div>
        <h1 style={{ color: "#0F172A", fontSize: 24, fontWeight: 700, margin: 0 }}>
          GlucoVida
        </h1>
        <p style={{ color: "#5B6B7C", fontSize: 14, margin: "4px 0 0" }}>
          Tu espacio de convivencia con la diabetes
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E6EEF5",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 4px 16px rgba(34,167,230,0.08)",
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            backgroundColor: "#F1F5F9",
            borderRadius: 10,
            padding: 4,
            marginBottom: 24,
          }}
        >
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: mode === m ? "#22A7E6" : "transparent",
                color: mode === m ? "#FFFFFF" : "#5B6B7C",
                transition: "all 0.2s",
              }}
            >
              {m === "login" ? "Ingresar" : "Registrarse"}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {error && (
          <div
            style={{
              backgroundColor: "#FEF2F2",
              border: "1px solid #EF4444",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#991B1B",
            }}
          >
            {errorTexts[error] ?? "Ocurrió un error. Intentá de nuevo."}
          </div>
        )}
        {mensaje && (
          <div
            style={{
              backgroundColor: "#F0FDF4",
              border: "1px solid #10B981",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#065F46",
            }}
          >
            {mensajeTexts[mensaje] ?? mensaje}
          </div>
        )}

        {/* Form */}
        <form action={mode === "login" ? signIn : signUp}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "#0F172A",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vos@ejemplo.com"
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #E6EEF5",
                borderRadius: 10,
                fontSize: 15,
                color: "#0F172A",
                backgroundColor: "#F8FAFC",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "#0F172A",
                marginBottom: 6,
              }}
            >
              Contraseña
            </label>
            <input
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
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #E6EEF5",
                borderRadius: 10,
                fontSize: 15,
                color: "#0F172A",
                backgroundColor: "#F8FAFC",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px 0",
              backgroundColor: "#22A7E6",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {mode === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
      </div>

      <p
        style={{
          color: "#5B6B7C",
          fontSize: 12,
          marginTop: 20,
          textAlign: "center",
        }}
      >
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
