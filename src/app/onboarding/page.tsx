"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { guardarOnboarding } from "./actions";

/**
 * Estado de un slot de insulina (rápida o basal/lenta). `seleccion` guarda el
 * valor lógico: "" (no usa / salteó), una marca conocida, "otra" (texto libre)
 * o "no_se" (usa pero no sabe la marca). El shadcn Select usa "no_uso" como
 * item para el "" (Radix no admite value="" en un item); se mapea en el borde.
 */
type SlotInsulina = { seleccion: string; marcaLibre: string };

const SLOT_VACIO: SlotInsulina = { seleccion: "", marcaLibre: "" };

/** Sentinel del Select para "No uso" (Radix no permite un item con value=""). */
const NO_USO = "no_uso";

const TOTAL_PASOS = 6;

/** Traduce un slot a la insulina a persistir, o null si no corresponde. */
function slotAInsulina(
  slot: SlotInsulina,
  claseDefault: ClaseInsulina
): { clase: ClaseInsulina; marca: string | null } | null {
  const sel = slot.seleccion;
  if (!sel) return null; // no usa / salteó
  if (sel === "no_se") return { clase: claseDefault, marca: null };
  if (sel === "otra") {
    const marca = slot.marcaLibre.trim();
    return { clase: claseDefault, marca: marca ? marca : null };
  }
  // Marca conocida: la clase real de la marca manda (NPH → lenta, etc.).
  return { clase: claseDeMarca(sel) ?? claseDefault, marca: sel };
}

export default function OnboardingPage() {
  const [paso, setPaso] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [tipoDiabetes, setTipoDiabetes] = useState<TipoDiabetes | null>(null);
  const [anio, setAnio] = useState<string>("");
  const [sexo, setSexo] = useState<Sexo | null>(null);
  const [peso, setPeso] = useState<string>("");
  const [altura, setAltura] = useState<string>("");
  const [slotRapida, setSlotRapida] = useState<SlotInsulina>(SLOT_VACIO);
  const [slotBasal, setSlotBasal] = useState<SlotInsulina>(SLOT_VACIO);

  // Foco al cambiar de paso: sin esto, remontar el paso (key={paso}) tira el
  // foco al <body> — el teclado reinicia desde arriba y los lectores de
  // pantalla no anuncian el paso nuevo (a11y: 2.4.3 / 4.1.3). Movemos el foco
  // al bloque del paso (o al título del cierre). El paso 0 conserva el
  // autoFocus de su input, así que no lo tocamos.
  const stepRef = useRef<HTMLDivElement>(null);
  const cierreRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (paso === TOTAL_PASOS) cierreRef.current?.focus();
    else if (paso > 0) stepRef.current?.focus();
  }, [paso]);

  function avanzar() {
    // Al terminar las 6 preguntas vamos a la pantalla de cierre (paso 6), no
    // directo al guardado: guardarOnboarding (que redirige) se llama desde ahí.
    if (paso < TOTAL_PASOS - 1) setPaso((p) => p + 1);
    else setPaso(TOTAL_PASOS);
  }

  function retroceder() {
    if (paso > 0) setPaso((p) => p - 1);
  }

  async function finalizar() {
    if (enviando) return;
    setEnviando(true);

    const anioNum = anio.trim() ? parseInt(anio, 10) : NaN;
    const pesoNum = peso.trim() ? parseFloat(peso) : NaN;
    const alturaNum = altura.trim() ? parseInt(altura, 10) : NaN;

    const insulinas = [
      slotAInsulina(slotRapida, "rapida"),
      slotAInsulina(slotBasal, "basal"),
    ].filter((i): i is { clase: ClaseInsulina; marca: string | null } => i !== null);

    try {
      await guardarOnboarding({
        nombre: nombre.trim() ? nombre.trim() : null,
        tipoDiabetes,
        anioNacimiento: Number.isInteger(anioNum) ? anioNum : null,
        sexo,
        pesoKg: Number.isFinite(pesoNum) ? pesoNum : null,
        alturaCm: Number.isInteger(alturaNum) ? alturaNum : null,
        insulinas,
      });
      // guardarOnboarding hace redirect('/chat') en el caso feliz.
    } catch (error) {
      // Ante un fallo de red del Server Action, no dejamos el botón trabado.
      console.error("[/onboarding] error finalizando:", error);
    } finally {
      setEnviando(false);
    }
  }

  // ── Pantalla de cierre (después de las 6 preguntas) ───────────────────────
  if (paso === TOTAL_PASOS) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-section px-4 py-10">
        <div
          key="cierre"
          className="w-full max-w-md animate-fade-slide-in text-center"
        >
          <div
            aria-hidden
            className="mx-auto mb-5 flex size-20 animate-float items-center justify-center rounded-circle bg-primary-air text-4xl"
          >
            🩵
          </div>
          <h1
            ref={cierreRef}
            tabIndex={-1}
            className="text-2xl font-black leading-title text-text outline-none"
          >
            {nombre.trim() ? `Listo, ${nombre.trim()}` : "Listo"}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-base leading-body text-muted">
            Gluco ya te está esperando. Cuando quieras, empezamos a charlar —
            a tu ritmo, sin apuro.
          </p>
          <div className="mx-auto mt-8 max-w-xs">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={finalizar}
              disabled={enviando}
            >
              {enviando && (
                <span
                  aria-hidden
                  className="inline-block size-4 animate-spin rounded-circle border-2 border-text/30 border-t-text"
                />
              )}
              {enviando ? "Entrando…" : "Entrar a Gluco"}
            </Button>
          </div>
          <div className="mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={retroceder}
              disabled={enviando}
            >
              ← Volver
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-section px-4 py-10">
      <div className="w-full max-w-md">
        {/* Encabezado cálido persistente */}
        <div className="mb-6 text-center">
          <div
            aria-hidden
            className="mx-auto mb-3 flex size-14 animate-float items-center justify-center rounded-circle bg-primary-air text-3xl"
          >
            🩵
          </div>
          <h1 className="text-2xl font-black leading-title text-text">
            Qué bueno tenerte acá
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-body text-muted">
            Antes de arrancar, ¿me contás un poco de vos? Son unas preguntas
            cortas y, menos tu nombre, podés saltar las que quieras.
          </p>
        </div>

        {/* Progreso: segmentos suaves — "vamos avanzando juntos" (no un %). */}
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_PASOS}
          aria-valuenow={paso + 1}
          aria-label={`Paso ${paso + 1} de ${TOTAL_PASOS}`}
          className="mb-6 flex items-center gap-1.5"
        >
          {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-pill transition-all duration-300",
                i <= paso ? "bg-gradient-strong" : "bg-primary-air"
              )}
            />
          ))}
        </div>

        {/* Tarjeta del paso */}
        <div className="rounded-card border border-border bg-white p-7 shadow-card-hover">
          {/* key={paso} → cada paso remonta y re-anima (fade + slight slide).
              ref/tabIndex: recibe el foco al cambiar de paso (ver useEffect). */}
          <div
            key={paso}
            ref={stepRef}
            tabIndex={-1}
            className="animate-fade-slide-in outline-none"
          >
            {paso === 0 && (
              <PasoNombre
                valor={nombre}
                onChange={setNombre}
                onContinuar={avanzar}
              />
            )}

            {paso === 1 && (
              <PasoTipo
                seleccion={tipoDiabetes}
                onSelect={(v) => {
                  setTipoDiabetes(v);
                  avanzar();
                }}
                onSaltar={avanzar}
              />
            )}

            {paso === 2 && (
              <PasoAnio
                valor={anio}
                onChange={setAnio}
                onContinuar={avanzar}
                onSaltar={avanzar}
              />
            )}

            {paso === 3 && (
              <PasoSexo
                seleccion={sexo}
                onElegir={(v) => {
                  setSexo(v);
                  avanzar();
                }}
              />
            )}

            {paso === 4 && (
              <PasoCuerpo
                peso={peso}
                altura={altura}
                onPeso={setPeso}
                onAltura={setAltura}
                onContinuar={avanzar}
                onSaltar={avanzar}
              />
            )}

            {paso === 5 && (
              <PasoInsulinas
                slotRapida={slotRapida}
                slotBasal={slotBasal}
                onSlotRapida={setSlotRapida}
                onSlotBasal={setSlotBasal}
                onContinuar={avanzar}
                onSaltar={avanzar}
              />
            )}
          </div>
        </div>

        {/* Atrás: navegación, disponible desde el 2º paso. */}
        {paso > 0 && (
          <div className="mt-3 text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={retroceder}
            >
              ← Atrás
            </Button>
          </div>
        )}

        <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-body text-muted">
          Casi nada de esto es obligatorio. Gluco te acompaña igual — con lo que
          quieras contar, te entiende un poco mejor.
        </p>
      </div>
    </div>
  );
}

// ── Piezas compartidas ──────────────────────────────────────────────────────

/**
 * Título + "por qué preguntamos esto". Jerarquía clara: el título manda, el
 * porqué queda debajo, en muted y más chico, pegado al campo (R4).
 */
function Pregunta({
  titulo,
  porque,
  porqueId,
}: {
  titulo: string;
  porque: string;
  // Si se pasa, el campo del paso lo referencia con aria-describedby para que
  // el lector de pantalla lea el "por qué" junto al campo (a11y: 1.3.1).
  porqueId?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-extrabold leading-title text-text">{titulo}</h2>
      <p id={porqueId} className="mt-1.5 text-sm leading-body text-muted">
        {porque}
      </p>
    </div>
  );
}

/**
 * Par de acciones de un paso salteable: "Continuar" y "Prefiero seguir" con la
 * MISMA prioridad visual (R5) — dos botones outline, mismo tamaño y contraste.
 * Ninguno es "la opción correcta"; se diferencian solo por su etiqueta.
 */
function AccionesPaso({
  onContinuar,
  onSaltar,
  continuarLabel = "Continuar",
  continuarDeshabilitado = false,
}: {
  onContinuar: () => void;
  onSaltar: () => void;
  continuarLabel?: string;
  continuarDeshabilitado?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="flex-1"
        onClick={onContinuar}
        disabled={continuarDeshabilitado}
      >
        {continuarLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="flex-1"
        onClick={onSaltar}
      >
        Prefiero seguir
      </Button>
    </div>
  );
}

/** Botón-card de una opción (tipo de diabetes / sexo). Táctil, con presencia. */
function OpcionCard({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex min-h-14 items-center justify-center rounded-input border px-3 py-3 text-center text-base font-semibold text-text transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2",
        activo
          ? "border-primary-strong bg-primary-air shadow-btn-hover"
          : "border-border-strong bg-white hover:border-primary-soft hover:bg-primary-air/50"
      )}
    >
      {children}
    </button>
  );
}

// ── Paso 0: nombre (requerido) ──────────────────────────────────────────────
function PasoNombre({
  valor,
  onChange,
  onContinuar,
}: {
  valor: string;
  onChange: (v: string) => void;
  onContinuar: () => void;
}) {
  const valido = valor.trim().length > 0;
  return (
    <div>
      <Pregunta
        titulo="¿Cómo querés que te llame?"
        porque="Es lo único que te pedimos sí o sí, para que Gluco te hable por tu nombre."
        porqueId="porque-nombre"
      />
      <Input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valido) onContinuar();
        }}
        placeholder="Tu nombre o como quieras que te diga"
        maxLength={40}
        autoFocus
        aria-label="Tu nombre"
        aria-describedby="porque-nombre"
      />
      <Button
        type="button"
        size="lg"
        className="mt-5 w-full"
        onClick={onContinuar}
        disabled={!valido}
      >
        Continuar
      </Button>
    </div>
  );
}

// ── Paso 1: tipo de diabetes ────────────────────────────────────────────────
function PasoTipo({
  seleccion,
  onSelect,
  onSaltar,
}: {
  seleccion: TipoDiabetes | null;
  onSelect: (v: TipoDiabetes) => void;
  onSaltar: () => void;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Qué tipo de diabetes tenés?"
        porque="Nos ayuda a que Gluco entienda mejor tu día a día. Si no estás segura/o, elegí “Otro”."
      />
      <div className="grid grid-cols-2 gap-2.5">
        {OPCIONES_TIPO_DIABETES.map((o) => (
          <OpcionCard
            key={o.valor}
            activo={seleccion === o.valor}
            onClick={() => onSelect(o.valor)}
          >
            {o.etiqueta}
          </OpcionCard>
        ))}
      </div>
      {/* Sin par Continuar/Saltar: elegir una card ya avanza. El saltar queda
          como un botón outline de igual peso, otra puerta igual de válida. */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        onClick={onSaltar}
      >
        Prefiero seguir
      </Button>
    </div>
  );
}

// ── Paso 2: año de nacimiento ───────────────────────────────────────────────
function PasoAnio({
  valor,
  onChange,
  onContinuar,
  onSaltar,
}: {
  valor: string;
  onChange: (v: string) => void;
  onContinuar: () => void;
  onSaltar: () => void;
}) {
  const anioNum = valor.trim() ? parseInt(valor, 10) : NaN;
  const valido = Number.isInteger(anioNum) && anioNum >= 1900 && anioNum <= 2026;
  return (
    <div>
      <Pregunta
        titulo="¿En qué año naciste?"
        porque="Solo para tener una idea de tu edad. No guardamos tu fecha exacta."
        porqueId="porque-anio"
      />
      <Input
        type="number"
        inputMode="numeric"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valido) onContinuar();
        }}
        placeholder="Ej: 1990"
        min={1900}
        max={2026}
        className="text-center"
        aria-label="Año de nacimiento"
        aria-describedby="porque-anio ayuda-anio"
      />
      {/* Pista del rango en vez de solo deshabilitar "Continuar" (a11y 3.3.1). */}
      <p id="ayuda-anio" className="mt-2 text-center text-xs text-muted">
        Un año entre 1900 y 2026.
      </p>
      <AccionesPaso
        onContinuar={onContinuar}
        onSaltar={onSaltar}
        continuarDeshabilitado={!valido}
      />
    </div>
  );
}

// ── Paso 3: sexo ────────────────────────────────────────────────────────────
function PasoSexo({
  seleccion,
  onElegir,
}: {
  seleccion: Sexo | null;
  onElegir: (v: Sexo) => void;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Cuál es tu sexo?"
        porque="Algunas cosas del cuerpo funcionan distinto. Si preferís no decir, está perfecto — es una opción más."
      />
      {/* "Prefiero no decir" es una card más: el saltar de este paso, con el
          mismo peso que el resto (R5). */}
      <div className="flex flex-col gap-2.5">
        {OPCIONES_SEXO.map((o) => (
          <OpcionCard
            key={o.valor}
            activo={seleccion === o.valor}
            onClick={() => onElegir(o.valor)}
          >
            {o.etiqueta}
          </OpcionCard>
        ))}
      </div>
    </div>
  );
}

// ── Paso 4: peso y altura ───────────────────────────────────────────────────
function PasoCuerpo({
  peso,
  altura,
  onPeso,
  onAltura,
  onContinuar,
  onSaltar,
}: {
  peso: string;
  altura: string;
  onPeso: (v: string) => void;
  onAltura: (v: string) => void;
  onContinuar: () => void;
  onSaltar: () => void;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Tu peso y altura?"
        porque="Nos ayuda a entender mejor las porciones y tu contexto. Nunca para juzgar tu cuerpo."
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="peso"
            className="mb-1.5 block text-xs font-semibold text-muted"
          >
            Peso (kg)
          </label>
          <Input
            id="peso"
            type="number"
            inputMode="decimal"
            value={peso}
            onChange={(e) => onPeso(e.target.value)}
            placeholder="Ej: 70"
            min={20}
            max={400}
            className="text-center"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor="altura"
            className="mb-1.5 block text-xs font-semibold text-muted"
          >
            Altura (cm)
          </label>
          <Input
            id="altura"
            type="number"
            inputMode="numeric"
            value={altura}
            onChange={(e) => onAltura(e.target.value)}
            placeholder="Ej: 170"
            min={50}
            max={250}
            className="text-center"
          />
        </div>
      </div>
      <AccionesPaso onContinuar={onContinuar} onSaltar={onSaltar} />
    </div>
  );
}

// ── Paso 5: insulinas (dos slots) ───────────────────────────────────────────
function PasoInsulinas({
  slotRapida,
  slotBasal,
  onSlotRapida,
  onSlotBasal,
  onContinuar,
  onSaltar,
}: {
  slotRapida: SlotInsulina;
  slotBasal: SlotInsulina;
  onSlotRapida: (s: SlotInsulina) => void;
  onSlotBasal: (s: SlotInsulina) => void;
  onContinuar: () => void;
  onSaltar: () => void;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Qué insulina usás?"
        porque="Así Gluco sabe de qué insulina hablás cuando la mencionás. Siempre como info, nunca te va a indicar una dosis."
      />

      <div className="flex flex-col gap-3">
        <SlotSelector
          titulo="Tu insulina rápida"
          ayuda="La de las comidas"
          idBase="rapida"
          marcas={MARCAS_RAPIDAS}
          slot={slotRapida}
          onChange={onSlotRapida}
        />
        <SlotSelector
          titulo="Tu insulina basal / lenta"
          ayuda="La de fondo, de acción prolongada"
          idBase="basal"
          marcas={MARCAS_BASAL_LENTA}
          slot={slotBasal}
          onChange={onSlotBasal}
        />
      </div>

      <p className="mt-4 text-xs leading-body text-muted">
        ¿Usás una premezcla (tipo NovoMix o Humalog Mix) u otra? Elegí “Otra” y
        escribila. Si no usás insulina, dejá los dos en “No uso”.
      </p>

      <AccionesPaso
        onContinuar={onContinuar}
        onSaltar={onSaltar}
        continuarLabel="Listo, terminé"
      />
    </div>
  );
}

/**
 * Un slot de insulina: sub-tarjeta propia (borde + fondo aire) para que los dos
 * slots se lean como bloques distintos (R7), con el dropdown tokenizado (shadcn
 * Select). Mapea el "" lógico ↔ item "no_uso" para no tocar slotAInsulina.
 */
function SlotSelector({
  titulo,
  ayuda,
  idBase,
  marcas,
  slot,
  onChange,
}: {
  titulo: string;
  ayuda: string;
  idBase: string;
  marcas: ReadonlyArray<{ marca: string; clase: ClaseInsulina }>;
  slot: SlotInsulina;
  onChange: (s: SlotInsulina) => void;
}) {
  const valueSelect = slot.seleccion === "" ? NO_USO : slot.seleccion;
  return (
    <div className="rounded-input border border-border bg-primary-air/40 p-4">
      <p className="text-sm font-bold text-text">{titulo}</p>
      <p className="mb-2.5 text-xs text-muted">{ayuda}</p>
      <Select
        value={valueSelect}
        onValueChange={(v) =>
          onChange({ seleccion: v === NO_USO ? "" : v, marcaLibre: "" })
        }
      >
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
      {slot.seleccion === "otra" && (
        <Input
          type="text"
          value={slot.marcaLibre}
          onChange={(e) => onChange({ ...slot, marcaLibre: e.target.value })}
          placeholder="¿Cuál?"
          maxLength={80}
          className="mt-2.5 bg-white"
          aria-label={`${titulo}: escribí la marca`}
        />
      )}
    </div>
  );
}
