"use client";

import { useState } from "react";
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

const AZUL = "#22A7E6";
const AZUL_FUERTE = "#1D90C7";
const AZUL_AIRE = "#D6EEFB";
const TEXTO = "#0F172A";
const MUTED = "#5B6B7C";
const BORDE = "#E6EEF5";

/**
 * Estado de un slot de insulina (rápida o basal/lenta). `seleccion` guarda el
 * valor del <select>: "" (no usa / salteó), una marca conocida, "otra" (texto
 * libre) o "no_se" (usa pero no sabe la marca).
 */
type SlotInsulina = { seleccion: string; marcaLibre: string };

const SLOT_VACIO: SlotInsulina = { seleccion: "", marcaLibre: "" };

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

  function avanzar() {
    if (paso < TOTAL_PASOS - 1) setPaso((p) => p + 1);
    else finalizar();
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

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px 32px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Encabezado cálido persistente */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: AZUL_AIRE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 10px",
            }}
          >
            🩵
          </div>
          <h1 style={{ color: TEXTO, fontSize: 20, fontWeight: 700, margin: 0 }}>
            Qué bueno tenerte acá
          </h1>
          <p style={{ color: MUTED, fontSize: 14, margin: "6px 0 0", lineHeight: 1.5 }}>
            Antes de arrancar, ¿me contás un poco de vos? Son unas preguntas
            cortas y, menos tu nombre, podés saltar las que quieras.
          </p>
        </div>

        {/* Progreso: puntitos */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === paso ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i <= paso ? AZUL : BORDE,
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>

        {/* Tarjeta del paso */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDE}`,
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 4px 16px rgba(34,167,230,0.08)",
          }}
        >
          {paso === 0 && (
            <PasoNombre valor={nombre} onChange={setNombre} onContinuar={avanzar} />
          )}

          {paso === 1 && (
            <PasoTipo
              seleccion={tipoDiabetes}
              onSelect={(v) => {
                setTipoDiabetes(v);
                avanzar();
              }}
            />
          )}

          {paso === 2 && (
            <PasoAnio valor={anio} onChange={setAnio} onContinuar={avanzar} />
          )}

          {paso === 3 && (
            <PasoSexo
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
            />
          )}

          {paso === 5 && (
            <PasoInsulinas
              slotRapida={slotRapida}
              slotBasal={slotBasal}
              onSlotRapida={setSlotRapida}
              onSlotBasal={setSlotBasal}
              onFinalizar={finalizar}
              enviando={enviando}
            />
          )}

          {/* Acciones comunes: atrás (desde el 2º paso) + saltar. El nombre (0)
              no se saltea; en sexo (3) "prefiero no decir" YA es el saltar. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 20,
            }}
          >
            {paso > 0 ? (
              <button
                onClick={retroceder}
                style={linkBtn(MUTED)}
                disabled={enviando}
              >
                ← Atrás
              </button>
            ) : (
              <span />
            )}

            {paso !== 0 && paso !== 3 && (
              <button
                onClick={avanzar}
                style={linkBtn(AZUL_FUERTE)}
                disabled={enviando}
              >
                Prefiero saltar esto →
              </button>
            )}
          </div>
        </div>

        <p
          style={{
            color: MUTED,
            fontSize: 12,
            marginTop: 18,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Casi nada de esto es obligatorio. Gluco te acompaña igual — con lo que
          quieras contar, te entiende un poco mejor.
        </p>
      </div>
    </div>
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
      />
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valido) onContinuar();
        }}
        placeholder="Tu nombre o como quieras que te diga"
        maxLength={40}
        autoFocus
        style={{
          width: "100%",
          padding: "12px 14px",
          border: `1px solid ${BORDE}`,
          borderRadius: 10,
          fontSize: 16,
          color: TEXTO,
          backgroundColor: "#F8FAFC",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <button
        onClick={onContinuar}
        disabled={!valido}
        style={{
          ...primaryBtn,
          marginTop: 16,
          backgroundColor: valido ? AZUL : BORDE,
          color: valido ? "#FFFFFF" : MUTED,
          cursor: valido ? "pointer" : "not-allowed",
        }}
      >
        Continuar
      </button>
    </div>
  );
}

// ── Paso 1: tipo de diabetes ────────────────────────────────────────────────
function PasoTipo({
  seleccion,
  onSelect,
}: {
  seleccion: TipoDiabetes | null;
  onSelect: (v: TipoDiabetes) => void;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Qué tipo de diabetes tenés?"
        porque="Nos ayuda a que Gluco entienda mejor tu día a día. Si no estás segura/o, elegí “Otro”."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {OPCIONES_TIPO_DIABETES.map((o) => (
          <button
            key={o.valor}
            onClick={() => onSelect(o.valor)}
            style={opcionBtn(seleccion === o.valor)}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Paso 2: año de nacimiento ───────────────────────────────────────────────
function PasoAnio({
  valor,
  onChange,
  onContinuar,
}: {
  valor: string;
  onChange: (v: string) => void;
  onContinuar: () => void;
}) {
  const anioNum = valor.trim() ? parseInt(valor, 10) : NaN;
  const valido =
    Number.isInteger(anioNum) && anioNum >= 1900 && anioNum <= 2026;
  return (
    <div>
      <Pregunta
        titulo="¿En qué año naciste?"
        porque="Solo para tener una idea de tu edad. No guardamos tu fecha exacta."
      />
      <input
        type="number"
        inputMode="numeric"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: 1990"
        min={1900}
        max={2026}
        style={{
          width: "100%",
          padding: "12px 14px",
          border: `1px solid ${BORDE}`,
          borderRadius: 10,
          fontSize: 16,
          color: TEXTO,
          backgroundColor: "#F8FAFC",
          outline: "none",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      />
      <button
        onClick={onContinuar}
        disabled={!valido}
        style={{
          ...primaryBtn,
          marginTop: 16,
          backgroundColor: valido ? AZUL : BORDE,
          color: valido ? "#FFFFFF" : MUTED,
          cursor: valido ? "pointer" : "not-allowed",
        }}
      >
        Continuar
      </button>
    </div>
  );
}

// ── Paso 3: sexo ────────────────────────────────────────────────────────────
function PasoSexo({ onElegir }: { onElegir: (v: Sexo) => void }) {
  return (
    <div>
      <Pregunta
        titulo="¿Cuál es tu sexo?"
        porque="Algunas cosas del cuerpo funcionan distinto. Si preferís no decir, está perfecto."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPCIONES_SEXO.map((o) => (
          <button
            key={o.valor}
            onClick={() => onElegir(o.valor)}
            style={opcionBtn(false)}
          >
            {o.etiqueta}
          </button>
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
}: {
  peso: string;
  altura: string;
  onPeso: (v: string) => void;
  onAltura: (v: string) => void;
  onContinuar: () => void;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Tu peso y altura?"
        porque="Nos ayuda a entender mejor las porciones y tu contexto. Nunca para juzgar tu cuerpo."
      />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={etiquetaInput}>Peso (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            value={peso}
            onChange={(e) => onPeso(e.target.value)}
            placeholder="Ej: 70"
            min={20}
            max={400}
            style={inputCentrado}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={etiquetaInput}>Altura (cm)</label>
          <input
            type="number"
            inputMode="numeric"
            value={altura}
            onChange={(e) => onAltura(e.target.value)}
            placeholder="Ej: 170"
            min={50}
            max={250}
            style={inputCentrado}
          />
        </div>
      </div>
      <button
        onClick={onContinuar}
        style={{ ...primaryBtn, marginTop: 16, backgroundColor: AZUL, color: "#FFFFFF" }}
      >
        Continuar
      </button>
    </div>
  );
}

// ── Paso 5: insulinas (dos slots) ───────────────────────────────────────────
function PasoInsulinas({
  slotRapida,
  slotBasal,
  onSlotRapida,
  onSlotBasal,
  onFinalizar,
  enviando,
}: {
  slotRapida: SlotInsulina;
  slotBasal: SlotInsulina;
  onSlotRapida: (s: SlotInsulina) => void;
  onSlotBasal: (s: SlotInsulina) => void;
  onFinalizar: () => void;
  enviando: boolean;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Qué insulina usás?"
        porque="Así Gluco sabe de qué insulina hablás cuando la mencionás. Siempre como info, nunca te va a indicar una dosis."
      />

      <SlotSelector
        titulo="Tu insulina rápida"
        ayuda="La de las comidas"
        marcas={MARCAS_RAPIDAS}
        slot={slotRapida}
        onChange={onSlotRapida}
      />
      <div style={{ height: 16 }} />
      <SlotSelector
        titulo="Tu insulina basal / lenta"
        ayuda="La de fondo, de acción prolongada"
        marcas={MARCAS_BASAL_LENTA}
        slot={slotBasal}
        onChange={onSlotBasal}
      />

      <p style={{ color: MUTED, fontSize: 12, margin: "16px 0 0", lineHeight: 1.5 }}>
        ¿Usás una premezcla (tipo NovoMix o Humalog Mix) u otra? Elegí “Otra” y
        escribila. Si no usás insulina, dejá los dos en blanco.
      </p>

      <button
        onClick={onFinalizar}
        disabled={enviando}
        style={{
          ...primaryBtn,
          marginTop: 20,
          backgroundColor: AZUL,
          color: "#FFFFFF",
          opacity: enviando ? 0.7 : 1,
        }}
      >
        {enviando ? "Guardando…" : "Listo, terminé"}
      </button>
    </div>
  );
}

function SlotSelector({
  titulo,
  ayuda,
  marcas,
  slot,
  onChange,
}: {
  titulo: string;
  ayuda: string;
  marcas: ReadonlyArray<{ marca: string; clase: ClaseInsulina }>;
  slot: SlotInsulina;
  onChange: (s: SlotInsulina) => void;
}) {
  return (
    <div>
      <p style={{ color: TEXTO, fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>
        {titulo}
      </p>
      <p style={{ color: MUTED, fontSize: 12, margin: "0 0 8px" }}>{ayuda}</p>
      <select
        value={slot.seleccion}
        onChange={(e) => onChange({ seleccion: e.target.value, marcaLibre: "" })}
        style={{
          width: "100%",
          padding: "12px 14px",
          border: `1px solid ${BORDE}`,
          borderRadius: 10,
          fontSize: 15,
          color: slot.seleccion ? TEXTO : MUTED,
          backgroundColor: "#F8FAFC",
          outline: "none",
          boxSizing: "border-box",
        }}
      >
        <option value="">No uso / no aplica</option>
        {marcas.map((m) => (
          <option key={m.marca} value={m.marca}>
            {m.marca}
          </option>
        ))}
        <option value="no_se">Uso pero no sé la marca</option>
        <option value="otra">Otra (escribir)</option>
      </select>
      {slot.seleccion === "otra" && (
        <input
          type="text"
          value={slot.marcaLibre}
          onChange={(e) => onChange({ ...slot, marcaLibre: e.target.value })}
          placeholder="¿Cuál?"
          maxLength={80}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "12px 14px",
            border: `1px solid ${BORDE}`,
            borderRadius: 10,
            fontSize: 15,
            color: TEXTO,
            backgroundColor: "#F8FAFC",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}
    </div>
  );
}

// ── Piezas compartidas ──────────────────────────────────────────────────────
function Pregunta({ titulo, porque }: { titulo: string; porque: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ color: TEXTO, fontSize: 18, fontWeight: 700, margin: 0 }}>
        {titulo}
      </h2>
      <p style={{ color: MUTED, fontSize: 13, margin: "6px 0 0", lineHeight: 1.5 }}>
        {porque}
      </p>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px 0",
  border: "none",
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 700,
  minHeight: 44,
};

const inputCentrado: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: `1px solid ${BORDE}`,
  borderRadius: 10,
  fontSize: 16,
  color: TEXTO,
  backgroundColor: "#F8FAFC",
  outline: "none",
  boxSizing: "border-box",
  textAlign: "center",
};

const etiquetaInput: React.CSSProperties = {
  display: "block",
  color: MUTED,
  fontSize: 12,
  fontWeight: 600,
  margin: "0 0 6px",
};

function opcionBtn(activo: boolean): React.CSSProperties {
  return {
    padding: "14px 12px",
    borderRadius: 12,
    border: `1.5px solid ${activo ? AZUL : BORDE}`,
    backgroundColor: activo ? AZUL_AIRE : "#F8FAFC",
    color: TEXTO,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 44,
    textAlign: "center",
    transition: "all 0.15s",
  };
}

function linkBtn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 0",
  };
}
