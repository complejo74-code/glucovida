import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  actualizarPerfil,
  agregarInsulina,
  eliminarInsulina,
} from "@/app/perfil/actions";

/**
 * Paso 10B-5 — feedback fiel de guardado. Antes las acciones tragaban el error
 * de Supabase y devolvían void, así que el frontend mostraba "guardado 💙"
 * aunque la escritura fallara. Estos tests fijan el contrato nuevo:
 * `{ ok: true }` cuando Supabase confirma, `{ ok: false, error }` cuando falla,
 * SIN filtrar el error crudo de Supabase a la UI (R3).
 */

// Estado mutable que controla qué devuelve el cliente Supabase mockeado. Se
// declara con vi.hoisted porque vi.mock se iza por encima del módulo.
const estado = vi.hoisted(() => ({
  error: null as { message: string } | null,
  usuario: { id: "user-1" } as { id: string } | null,
}));

// Query builder encadenable y "thenable": update/insert/delete/eq devuelven el
// mismo objeto, y await resuelve a { error } (como el SDK real).
interface QueryMock {
  update: () => QueryMock;
  insert: () => QueryMock;
  delete: () => QueryMock;
  eq: () => QueryMock;
  then: (resolve: (value: { error: { message: string } | null }) => void) => void;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const query: QueryMock = {
      update: () => query,
      insert: () => query,
      delete: () => query,
      eq: () => query,
      then: (resolve) => resolve({ error: estado.error }),
    };
    return {
      auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
      from: () => query,
    };
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

const PAYLOAD = {
  nombre: "Sofi",
  tipoDiabetes: "DM1" as const,
  anioNacimiento: 1990,
  sexo: "femenino" as const,
  pesoKg: 70,
  alturaCm: 170,
};

beforeEach(() => {
  estado.error = null;
  estado.usuario = { id: "user-1" };
});

describe("actualizarPerfil — resultado fiel", () => {
  test("Supabase confirma → { ok: true }", async () => {
    estado.error = null;
    await expect(actualizarPerfil(PAYLOAD)).resolves.toEqual({ ok: true });
  });

  test("Supabase devuelve error → { ok: false } (no éxito silencioso)", async () => {
    estado.error = { message: "new row violates row-level security policy" };
    const res = await actualizarPerfil(PAYLOAD);
    expect(res.ok).toBe(false);
  });

  test("el error para la UI es cálido, nunca el crudo de Supabase (R3)", async () => {
    estado.error = { message: "new row violates row-level security policy" };
    const res = await actualizarPerfil(PAYLOAD);
    if (res.ok) throw new Error("se esperaba ok:false");
    expect(res.error).not.toContain("row-level security");
    expect(res.error).toContain("¿Probamos de nuevo?");
  });
});

describe("agregarInsulina — resultado fiel", () => {
  test("Supabase confirma → { ok: true }", async () => {
    estado.error = null;
    await expect(agregarInsulina("rapida", "Humalog")).resolves.toEqual({
      ok: true,
    });
  });

  test("Supabase devuelve error → { ok: false } con mensaje cálido", async () => {
    estado.error = { message: "duplicate key value" };
    const res = await agregarInsulina("rapida", "Humalog");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("duplicate key");
  });
});

describe("eliminarInsulina — resultado fiel", () => {
  test("Supabase confirma → { ok: true }", async () => {
    estado.error = null;
    await expect(eliminarInsulina("ins-1")).resolves.toEqual({ ok: true });
  });

  test("Supabase devuelve error → { ok: false } con mensaje cálido", async () => {
    estado.error = { message: "permission denied for table" };
    const res = await eliminarInsulina("ins-1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("permission denied");
  });
});
