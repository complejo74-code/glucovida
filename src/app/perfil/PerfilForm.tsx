"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MARCAS_BASAL_LENTA,
  MARCAS_RAPIDAS,
  OPCIONES_SEXO,
  OPCIONES_TIPO_DIABETES,
  claseDeMarca,
  type ClaseInsulina,
  type Sexo,
  type TipoDiabetes,
} from "@/lib/perfil/tipos";
import { actualizarPerfil, agregarInsulina, eliminarInsulina } from "./actions";

/** Una insulina activa del usuario (tal como la carga la page vía RLS). */
interface InsulinaItem {
  id: string;
  clase: ClaseInsulina;
  marca: string | null;
}

/** Sentinel del Select para "No uso" (Radix no permite un item con value=""). */
const NO_USO = "no_uso";

/** Objetivo a persistir para un slot, o null = desactivar. */
type TargetInsulina = { clase: ClaseInsulina; marca: string | null } | null;

/** Toast cálido de feedback (R4 + edge case de error). */
type Toast = { tono: "exito" | "error"; texto: string };

export default function PerfilForm({
  inicial,
  insulinas,
}: {
  inicial: {
    nombre: string | null;
    tipoDiabetes: TipoDiabetes | null;
    anioNacimiento: number | null;
    sexo: Sexo | null;
    pesoKg: number | null;
    alturaCm: number | null;
  };
  insulinas: InsulinaItem[];
}) {
  const [nombre, setNombre] = useState(inicial.nombre ?? "");
  const [tipoDiabetes, setTipoDiabetes] = useState<TipoDiabetes | null>(
    inicial.tipoDiabetes
  );
  const [anio, setAnio] = useState(
    inicial.anioNacimiento ? String(inicial.anioNacimiento) : ""
  );
  const [sexo, setSexo] = useState<Sexo | null>(inicial.sexo);
  const [peso, setPeso] = useState(inicial.pesoKg ? String(inicial.pesoKg) : "");
  const [altura, setAltura] = useState(
    inicial.alturaCm ? String(inicial.alturaCm) : ""
  );
  const [pending, startTransition] = useTransition();

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function mostrarToast(tono: Toast["tono"], texto: string) {
    setToast({ tono, texto });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // Mensaje cálido de fallback ante una falla observable (red / acción que lanza),
  // cuando la acción ni siquiera pudo devolver un resultado (R2/R3).
  const ERROR_RED = "Algo no salió como esperábamos. ¿Probamos de nuevo?";

  // ── Guardar datos personales + cuerpo (R4) ──────────────────────────────────
  // Lógica de guardado intacta (R7): mismo payload y misma Server Action. Ahora
  // el toast se decide con el resultado REAL de la escritura ({ ok, error }): el
  // "guardado 💙" solo aparece si la DB confirmó (R2). Qué/cómo se persiste no
  // cambia (R4); solo se propaga y usa el resultado.
  function guardar() {
    const anioNum = anio.trim() ? parseInt(anio, 10) : NaN;
    const pesoNum = peso.trim() ? parseFloat(peso) : NaN;
    const alturaNum = altura.trim() ? parseInt(altura, 10) : NaN;
    startTransition(async () => {
      try {
        const res = await actualizarPerfil({
          nombre: nombre.trim() ? nombre.trim() : null,
          tipoDiabetes,
          anioNacimiento: Number.isInteger(anioNum) ? anioNum : null,
          sexo,
          pesoKg: Number.isFinite(pesoNum) ? pesoNum : null,
          alturaCm: Number.isInteger(alturaNum) ? alturaNum : null,
        });
        if (res.ok) mostrarToast("exito", "Listo, guardado 💙");
        else mostrarToast("error", res.error);
      } catch {
        mostrarToast("error", ERROR_RED);
      }
    });
  }

  // ── Aplicar un cambio de slot de insulina (agregar / desactivar / cambiar) ──
  // Usa SOLO las Server Actions existentes (R7): cambiar = eliminar la anterior +
  // agregar la nueva; desactivar = eliminar. Ninguna acción se modifica. El toast
  // se decide con el resultado real de cada escritura (R2), y el caso de guardado
  // PARCIAL (se borró la anterior pero el alta de la nueva falló) se comunica
  // distinto de un fallo total (edge case): el usuario tiene que saber que quedó
  // sin la insulina que tenía. Reintentar vuelve a correr sin recargar.
  function aplicarSlot(actual: InsulinaItem | null, target: TargetInsulina) {
    startTransition(async () => {
      try {
        // Desactivar: solo eliminar la actual (si había).
        if (!target) {
          if (actual) {
            const del = await eliminarInsulina(actual.id);
            if (!del.ok) return mostrarToast("error", del.error);
          }
          return mostrarToast("exito", "Insulinas actualizadas 💙");
        }

        // Cambiar / agregar: eliminar la anterior (si había) y luego agregar.
        if (actual) {
          const del = await eliminarInsulina(actual.id);
          if (!del.ok) return mostrarToast("error", del.error);
        }
        const add = await agregarInsulina(target.clase, target.marca ?? "");
        if (!add.ok) {
          // Falla parcial: si había una anterior, ya se borró y la nueva no entró.
          // No es lo mismo que "no pasó nada": hay que avisarlo distinto.
          return mostrarToast(
            "error",
            actual
              ? "Quitamos la anterior pero no pudimos guardar la nueva. Volvé a elegirla, por favor."
              : add.error
          );
        }
        mostrarToast("exito", "Insulinas actualizadas 💙");
      } catch {
        mostrarToast("error", ERROR_RED);
      }
    });
  }

  // Reparto de las insulinas activas en los dos slots del onboarding. Lo que no
  // encaja (una mixta, o una segunda del mismo tipo) NO se oculta: cae en "otras"
  // para poder verlo y quitarlo (no se pierde ni un dato — R7).
  const slotRapida = insulinas.find((i) => i.clase === "rapida") ?? null;
  const slotBasal =
    insulinas.find((i) => i.clase === "basal" || i.clase === "lenta") ?? null;
  const otras = insulinas.filter(
    (i) => i.id !== slotRapida?.id && i.id !== slotBasal?.id
  );
  const sinInsulinas = insulinas.length === 0;

  return (
    <div className="min-h-dvh bg-gradient-section px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        {/* Volver al chat (R6) */}
        <div className="mb-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/chat">
              <ArrowLeft aria-hidden />
              Volver al chat
            </Link>
          </Button>
        </div>

        {/* Encabezado cálido, consistente con el onboarding */}
        <div className="mb-5 text-center">
          <div
            aria-hidden
            className="mx-auto mb-3 flex size-14 items-center justify-center rounded-circle bg-primary-air text-3xl"
          >
            🩵
          </div>
          <h1 className="text-2xl font-black leading-title text-text">
            Tu perfil
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-body text-muted">
            Esto ayuda a Gluco a acompañarte mejor. Cambiá lo que quieras, cuando
            quieras — las cosas cambian.
          </p>
        </div>

        {/* Toast de feedback (R4). Región viva SIEMPRE presente en el DOM para
            que el lector de pantalla anuncie el cambio de forma fiable (si se
            montara junto con el texto, algunos SR se lo pierden). El pill se
            renderiza adentro según haya toast. */}
        <div role="status" aria-live="polite">
          {toast && (
            <div
              className={cn(
                "mb-4 animate-fade-slide-in rounded-pill border px-4 py-2.5 text-center text-sm font-bold",
                toast.tono === "error"
                  ? "border-danger bg-danger/10 text-text"
                  : "border-success bg-success/10 text-text"
              )}
            >
              {toast.texto}
            </div>
          )}
        </div>

        {/* ── Card 1: datos personales + cuerpo ── */}
        <div className="rounded-card border border-border bg-white p-6 shadow-card-hover">
          {/* Bloque: sobre vos */}
          <Bloque
            titulo="Sobre vos"
            ayuda="Lo básico para que Gluco te hable por tu nombre y en tu contexto."
          >
            <Campo htmlFor="nombre" etiqueta="¿Cómo querés que te llame?">
              <Input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                maxLength={40}
              />
            </Campo>

            <Campo etiqueta="Tipo de diabetes" comoFieldset>
              <div className="grid grid-cols-2 gap-2.5">
                {OPCIONES_TIPO_DIABETES.map((o) => (
                  <OpcionToggle
                    key={o.valor}
                    activo={tipoDiabetes === o.valor}
                    onClick={() =>
                      setTipoDiabetes((prev) => (prev === o.valor ? null : o.valor))
                    }
                  >
                    {o.etiqueta}
                  </OpcionToggle>
                ))}
              </div>
            </Campo>

            <Campo htmlFor="anio" etiqueta="Año de nacimiento">
              <Input
                id="anio"
                type="number"
                inputMode="numeric"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                placeholder="Ej: 1990"
                min={1900}
                max={2026}
              />
            </Campo>

            <Campo etiqueta="Sexo" comoFieldset>
              <div className="flex flex-wrap gap-2.5">
                {OPCIONES_SEXO.map((o) => (
                  <OpcionToggle
                    key={o.valor}
                    activo={sexo === o.valor}
                    className="flex-1 whitespace-nowrap"
                    onClick={() =>
                      setSexo((prev) => (prev === o.valor ? null : o.valor))
                    }
                  >
                    {o.etiqueta}
                  </OpcionToggle>
                ))}
              </div>
            </Campo>
          </Bloque>

          <Separador />

          {/* Bloque: tu cuerpo — SIN IMC ni juicio (R5) */}
          <Bloque
            titulo="Tu cuerpo"
            ayuda="Solo para dar contexto a Gluco. Nunca para juzgar tu cuerpo."
          >
            <div className="flex gap-3">
              <Campo htmlFor="peso" etiqueta="Peso (kg)" className="flex-1">
                <Input
                  id="peso"
                  type="number"
                  inputMode="decimal"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  placeholder="Ej: 70"
                  min={20}
                  max={400}
                  className="text-center"
                />
              </Campo>
              <Campo htmlFor="altura" etiqueta="Altura (cm)" className="flex-1">
                <Input
                  id="altura"
                  type="number"
                  inputMode="numeric"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  placeholder="Ej: 170"
                  min={50}
                  max={250}
                  className="text-center"
                />
              </Campo>
            </div>
          </Bloque>

          {/* Guardar (R4): gradiente + pill (Button primary) */}
          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            onClick={guardar}
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>

        {/* ── Card 2: insulinas (dos slots como el onboarding, R3) ── */}
        <div className="mt-5 rounded-card border border-border bg-white p-6 shadow-card-hover">
          <Bloque
            titulo="Tus insulinas"
            ayuda="Así Gluco sabe de cuáles hablás. Siempre como info, nunca te va a indicar una dosis."
          >
            {sinInsulinas && (
              <p className="mb-3 rounded-input bg-primary-air/50 px-4 py-3 text-sm leading-body text-text">
                Todavía no cargaste tus insulinas — elegí abajo las que uses y
                Gluco las tiene en cuenta.
              </p>
            )}

            <div className="flex flex-col gap-3">
              <SlotInsulina
                titulo="Tu insulina rápida"
                ayuda="La de las comidas"
                marcas={MARCAS_RAPIDAS}
                claseDefault="rapida"
                actual={slotRapida}
                pending={pending}
                onAplicar={aplicarSlot}
              />
              <SlotInsulina
                titulo="Tu insulina basal / lenta"
                ayuda="La de fondo, de acción prolongada"
                marcas={MARCAS_BASAL_LENTA}
                claseDefault="basal"
                actual={slotBasal}
                pending={pending}
                onAplicar={aplicarSlot}
              />
            </div>

            {/* "Otras": lo que no entra en los dos slots (mixtas, duplicadas).
                No se oculta para no perder datos; se puede quitar. */}
            {otras.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-muted">
                  Otras que tenés cargadas
                </p>
                <div className="flex flex-col gap-2">
                  {otras.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between gap-2 rounded-input border border-border bg-primary-air/40 px-4 py-2.5"
                    >
                      <span className="text-sm text-text">
                        {claseEtiqueta(i.clase)}
                        {i.marca ? ` · ${i.marca}` : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar ${claseEtiqueta(i.clase)}${
                          i.marca ? ` ${i.marca}` : ""
                        }`}
                        disabled={pending}
                        onClick={() => aplicarSlot(i, null)}
                      >
                        <span aria-hidden className="text-lg leading-none">
                          ×
                        </span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-xs leading-body text-muted">
              ¿Usás una premezcla (tipo NovoMix o Humalog Mix) u otra? Elegí “Otra”
              y escribila. Si no usás insulina, dejá los dos en “No uso”.
            </p>
          </Bloque>
        </div>
      </div>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────────────────

/** Bloque de campos con título suave (no "formulario médico", R2). */
function Bloque({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-extrabold leading-title text-text">
        {titulo}
      </h2>
      <p className="mt-1 mb-4 text-xs leading-body text-muted">{ayuda}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Separador suave entre bloques (R2). */
function Separador() {
  return <div className="my-6 border-t border-border" />;
}

/**
 * Campo con label accesible. Para grupos de botones (tipo/sexo) usa
 * `comoFieldset` → renderiza <fieldset>/<legend> en vez de <label> (a11y 1.3.1).
 */
function Campo({
  etiqueta,
  htmlFor,
  className,
  comoFieldset = false,
  children,
}: {
  etiqueta: string;
  htmlFor?: string;
  className?: string;
  comoFieldset?: boolean;
  children: React.ReactNode;
}) {
  if (comoFieldset) {
    return (
      <fieldset className={cn("m-0 border-0 p-0", className)}>
        <legend className="mb-1.5 p-0 text-xs font-semibold text-muted">
          {etiqueta}
        </legend>
        {children}
      </fieldset>
    );
  }
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold text-muted"
      >
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

/** Botón-opción toggle (tipo de diabetes / sexo). Táctil (≥44px), aria-pressed. */
function OpcionToggle({
  activo,
  onClick,
  className,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-input border px-3 py-2.5 text-center text-sm font-semibold text-text transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2",
        activo
          ? "border-primary-strong bg-primary-air shadow-btn-hover"
          : "border-border-strong bg-white hover:border-primary-soft hover:bg-primary-air/50",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Etiqueta legible de una clase de insulina (para "otras"). */
function claseEtiqueta(clase: ClaseInsulina): string {
  switch (clase) {
    case "rapida":
      return "Rápida";
    case "basal":
      return "Basal";
    case "lenta":
      return "Lenta / NPH";
    case "mixta":
      return "Mixta";
  }
}

/** Valor lógico del Select derivado de la insulina activa del slot. */
function valorDeActual(
  actual: InsulinaItem | null,
  marcas: ReadonlyArray<{ marca: string }>
): string {
  if (!actual) return NO_USO;
  // El `&&` narrowea `marca` a string, así el return no necesita aserción.
  if (actual.marca && marcas.some((m) => m.marca === actual.marca)) {
    return actual.marca;
  }
  if (actual.marca) return "otra"; // marca fuera de lista → texto libre
  return "no_se"; // usa, sin marca
}

/** Traduce la selección del Select al objetivo a persistir. */
function targetDeSeleccion(
  v: string,
  libre: string,
  claseDefault: ClaseInsulina
): TargetInsulina {
  if (v === NO_USO) return null;
  if (v === "no_se") return { clase: claseDefault, marca: null };
  if (v === "otra") {
    const marca = libre.trim();
    return { clase: claseDefault, marca: marca ? marca : null };
  }
  // Marca conocida: la clase real de la marca manda (NPH → lenta, etc.).
  return { clase: claseDeMarca(v) ?? claseDefault, marca: v };
}

/**
 * Slot de insulina (rápida o basal/lenta): sub-tarjeta propia (borde + aire),
 * como en el onboarding (R3), con el dropdown tokenizado (shadcn Select).
 * Agregar / desactivar / cambiar se resuelven vía las Server Actions existentes
 * en el padre (aplicarSlot). El "" lógico se mapea al item "no_uso".
 */
function SlotInsulina({
  titulo,
  ayuda,
  marcas,
  claseDefault,
  actual,
  pending,
  onAplicar,
}: {
  titulo: string;
  ayuda: string;
  marcas: ReadonlyArray<{ marca: string; clase: ClaseInsulina }>;
  claseDefault: ClaseInsulina;
  actual: InsulinaItem | null;
  pending: boolean;
  onAplicar: (actual: InsulinaItem | null, target: TargetInsulina) => void;
}) {
  const valorActual = valorDeActual(actual, marcas);
  // `edicionOtra` mantiene el modo "Otra" mientras se escribe, sin aplicar hasta
  // confirmar. null = seguir el valor derivado de `actual`.
  const [edicionOtra, setEdicionOtra] = useState<string | null>(null);
  const enOtra = edicionOtra !== null || valorActual === "otra";
  const valueSelect = edicionOtra !== null ? "otra" : valorActual;

  function onCambioSelect(v: string) {
    if (v === "otra") {
      // Entrar a modo texto libre, precargando la marca actual si la había.
      setEdicionOtra(valorActual === "otra" ? actual?.marca ?? "" : "");
      return;
    }
    setEdicionOtra(null);
    onAplicar(actual, targetDeSeleccion(v, "", claseDefault));
  }

  function confirmarOtra() {
    if (edicionOtra === null) return;
    onAplicar(actual, targetDeSeleccion("otra", edicionOtra, claseDefault));
    setEdicionOtra(null);
  }

  return (
    <div className="rounded-input border border-border bg-primary-air/40 p-4">
      <p className="text-sm font-bold text-text">{titulo}</p>
      <p className="mb-2.5 text-xs text-muted">{ayuda}</p>
      <Select value={valueSelect} onValueChange={onCambioSelect} disabled={pending}>
        <SelectTrigger className="bg-white" aria-label={titulo}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_USO}>No uso / no aplica</SelectItem>
          {marcas.map((m) => (
            <SelectItem key={m.marca} value={m.marca}>
              {m.marca}
            </SelectItem>
          ))}
          <SelectItem value="no_se">Uso pero no sé la marca</SelectItem>
          <SelectItem value="otra">Otra (escribir)</SelectItem>
        </SelectContent>
      </Select>

      {enOtra && (
        <div className="mt-2.5 flex gap-2">
          <Input
            type="text"
            value={edicionOtra ?? actual?.marca ?? ""}
            onChange={(e) => setEdicionOtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmarOtra();
              }
            }}
            placeholder="¿Cuál?"
            maxLength={80}
            className="flex-1 bg-white"
            aria-label={`${titulo}: escribí la marca`}
          />
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={confirmarOtra}
            disabled={pending || edicionOtra === null}
          >
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}
