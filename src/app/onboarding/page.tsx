"use client";

import { useState } from "react";
import {
  OPCIONES_CLASE_INSULINA,
  OPCIONES_TIPO_DIABETES,
  type ClaseInsulina,
  type TipoDiabetes,
} from "@/lib/perfil/tipos";
import { guardarOnboarding } from "./actions";

const AZUL = "#22A7E6";
const AZUL_FUERTE = "#1D90C7";
const AZUL_AIRE = "#D6EEFB";
const TEXTO = "#0F172A";
const MUTED = "#5B6B7C";
const BORDE = "#E6EEF5";

type InsulinaDraft = { clase: ClaseInsulina; marca: string };

const TOTAL_PASOS = 4;

export default function OnboardingPage() {
  const [paso, setPaso] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const [tipoDiabetes, setTipoDiabetes] = useState<TipoDiabetes | null>(null);
  const [anio, setAnio] = useState<string>("");
  const [menstrua, setMenstrua] = useState<boolean | null>(null);
  const [insulinas, setInsulinas] = useState<InsulinaDraft[]>([]);
  const [claseDraft, setClaseDraft] = useState<ClaseInsulina | "">("");
  const [marcaDraft, setMarcaDraft] = useState("");

  function avanzar() {
    if (paso < TOTAL_PASOS - 1) setPaso((p) => p + 1);
    else finalizar();
  }

  function retroceder() {
    if (paso > 0) setPaso((p) => p - 1);
  }

  function agregarInsulina() {
    if (!claseDraft) return;
    setInsulinas((prev) => [...prev, { clase: claseDraft, marca: marcaDraft.trim() }]);
    setClaseDraft("");
    setMarcaDraft("");
  }

  async function finalizar() {
    if (enviando) return;
    setEnviando(true);
    const anioNum = anio.trim() ? parseInt(anio, 10) : NaN;
    try {
      await guardarOnboarding({
        tipoDiabetes,
        anioNacimiento: Number.isInteger(anioNum) ? anioNum : null,
        menstrua,
        insulinas: insulinas.map((i) => ({
          clase: i.clase,
          marca: i.marca ? i.marca : null,
        })),
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
            Antes de arrancar, ¿me contás un poco de vos? Son cuatro preguntas
            cortas y podés saltar las que quieras.
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
            <PasoTipo
              seleccion={tipoDiabetes}
              onSelect={(v) => {
                setTipoDiabetes(v);
                avanzar();
              }}
            />
          )}

          {paso === 1 && (
            <PasoAnio
              valor={anio}
              onChange={setAnio}
              onContinuar={avanzar}
            />
          )}

          {paso === 2 && (
            <PasoMenstrua
              onElegir={(v) => {
                setMenstrua(v);
                avanzar();
              }}
            />
          )}

          {paso === 3 && (
            <PasoInsulinas
              insulinas={insulinas}
              claseDraft={claseDraft}
              marcaDraft={marcaDraft}
              onClaseDraft={setClaseDraft}
              onMarcaDraft={setMarcaDraft}
              onAgregar={agregarInsulina}
              onQuitar={(idx) =>
                setInsulinas((prev) => prev.filter((_, i) => i !== idx))
              }
              onNinguna={() => {
                setInsulinas([]);
                finalizar();
              }}
              onFinalizar={finalizar}
              enviando={enviando}
            />
          )}

          {/* Acciones comunes: saltar (siempre) + atrás (desde el 2º paso) */}
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

            {/* En el paso del ciclo, "prefiero no decir" YA es la opción de
                saltar (mismo peso visual): no repetimos el link acá. */}
            {paso !== 2 && (
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
          Nada de esto es obligatorio. Gluco te acompaña igual — con lo que
          quieras contar, te entiende un poco mejor.
        </p>
      </div>
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

// ── Paso 3: ciclo menstrual ─────────────────────────────────────────────────
function PasoMenstrua({ onElegir }: { onElegir: (v: boolean | null) => void }) {
  return (
    <div>
      <Pregunta
        titulo="¿Menstruás?"
        porque="Las hormonas del ciclo a veces mueven la glucemia. Es algo íntimo: si preferís no decir, está perfecto."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => onElegir(true)} style={opcionBtn(false)}>
          Sí
        </button>
        <button onClick={() => onElegir(false)} style={opcionBtn(false)}>
          No
        </button>
        {/* Mismo peso visual que las otras: saltar debe sentirse igual de natural. */}
        <button onClick={() => onElegir(null)} style={opcionBtn(false)}>
          Prefiero no decir
        </button>
      </div>
    </div>
  );
}

// ── Paso 4: insulinas ───────────────────────────────────────────────────────
function PasoInsulinas({
  insulinas,
  claseDraft,
  marcaDraft,
  onClaseDraft,
  onMarcaDraft,
  onAgregar,
  onQuitar,
  onNinguna,
  onFinalizar,
  enviando,
}: {
  insulinas: InsulinaDraft[];
  claseDraft: ClaseInsulina | "";
  marcaDraft: string;
  onClaseDraft: (v: ClaseInsulina | "") => void;
  onMarcaDraft: (v: string) => void;
  onAgregar: () => void;
  onQuitar: (idx: number) => void;
  onNinguna: () => void;
  onFinalizar: () => void;
  enviando: boolean;
}) {
  return (
    <div>
      <Pregunta
        titulo="¿Usás insulina?"
        porque="Si nos contás cuáles, Gluco puede hablarte de las tuyas. Siempre como info, nunca te va a indicar una dosis."
      />

      {/* Insulinas ya agregadas */}
      {insulinas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {insulinas.map((i, idx) => {
            const etiqueta =
              OPCIONES_CLASE_INSULINA.find((o) => o.valor === i.clase)?.etiqueta ??
              i.clase;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  backgroundColor: AZUL_AIRE,
                  borderRadius: 10,
                  fontSize: 14,
                  color: TEXTO,
                }}
              >
                <span>
                  {etiqueta}
                  {i.marca ? ` · ${i.marca}` : ""}
                </span>
                <button
                  onClick={() => onQuitar(idx)}
                  aria-label="Quitar"
                  style={{ ...linkBtn(MUTED), fontSize: 18, padding: 0 }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Alta de una insulina */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <select
          value={claseDraft}
          onChange={(e) => onClaseDraft(e.target.value as ClaseInsulina | "")}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: `1px solid ${BORDE}`,
            borderRadius: 10,
            fontSize: 15,
            color: claseDraft ? TEXTO : MUTED,
            backgroundColor: "#F8FAFC",
            outline: "none",
            boxSizing: "border-box",
          }}
        >
          <option value="">Elegí el tipo…</option>
          {OPCIONES_CLASE_INSULINA.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta} — {o.ayuda}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={marcaDraft}
          onChange={(e) => onMarcaDraft(e.target.value)}
          placeholder="Marca (opcional): Lantus, Humalog…"
          style={{
            width: "100%",
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
        <button
          onClick={onAgregar}
          disabled={!claseDraft}
          style={{
            ...secondaryBtn,
            opacity: claseDraft ? 1 : 0.5,
            cursor: claseDraft ? "pointer" : "not-allowed",
          }}
        >
          + Agregar esta insulina
        </button>
      </div>

      {/* Cierre */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={onFinalizar}
          disabled={enviando}
          style={{
            ...primaryBtn,
            backgroundColor: AZUL,
            color: "#FFFFFF",
            opacity: enviando ? 0.7 : 1,
          }}
        >
          {enviando
            ? "Guardando…"
            : insulinas.length > 0
              ? "Listo, terminé"
              : "Continuar"}
        </button>
        {insulinas.length === 0 && (
          <button onClick={onNinguna} disabled={enviando} style={linkBtn(MUTED)}>
            No uso insulina
          </button>
        )}
      </div>
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

const secondaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "10px 0",
  border: `1px solid ${AZUL}`,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  color: AZUL_FUERTE,
  backgroundColor: "#FFFFFF",
  minHeight: 44,
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
