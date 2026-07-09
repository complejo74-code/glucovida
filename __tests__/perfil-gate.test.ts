import { describe, expect, test } from "vitest";
import { requiereOnboarding } from "@/lib/perfil/gate";

describe("requiereOnboarding — gate del onboarding (paso 9)", () => {
  test("onboarding incompleto en /chat → redirige", () => {
    expect(requiereOnboarding("/chat", false)).toBe(true);
  });

  test("onboarding completo → nunca redirige", () => {
    expect(requiereOnboarding("/chat", true)).toBe(false);
  });

  // FAILSAFE: el corazón del ajuste pedido. Error de red/Supabase → null.
  test("estado desconocido (null) → FALLA ABIERTO, deja pasar a /chat", () => {
    expect(requiereOnboarding("/chat", null)).toBe(false);
  });

  test("no redirige desde /onboarding (evita loop) aunque esté incompleto", () => {
    expect(requiereOnboarding("/onboarding", false)).toBe(false);
  });

  test("no redirige desde rutas exentas (/login, /auth) estando incompleto", () => {
    expect(requiereOnboarding("/login", false)).toBe(false);
    expect(requiereOnboarding("/auth/confirm", false)).toBe(false);
  });

  test("no redirige rutas /api (un fetch no debe recibir redirect a HTML)", () => {
    expect(requiereOnboarding("/api/chat", false)).toBe(false);
  });

  test("incompleto en /perfil también redirige a onboarding primero", () => {
    expect(requiereOnboarding("/perfil", false)).toBe(true);
  });
});
