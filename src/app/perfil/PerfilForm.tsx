"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  OPCIONES_CLASE_INSULINA,
  OPCIONES_SEXO,
  OPCIONES_TIPO_DIABETES,
  marcasDeClase,
  type ClaseInsulina,
  type Sexo,
  type TipoDiabetes,
} from "@/lib/perfil/tipos";
import { actualizarPerfil, agregarInsulina, eliminarInsulina } from "./actions";

const AZUL = "#22A7E6";
const AZUL_FUERTE = "#1D90C7";
const AZUL_AIRE = "#D6EEFB";
const TEXTO = "#0F172A";
const MUTED = "#5B6B7C";
const BORDE = "#E6EEF5";
const EXITO = "#10B981";

interface InsulinaItem {
  id: string;
  clase: ClaseInsulina;
  marca: string | null;
}

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
  const [claseDraft, setClaseDraft] = useState<ClaseInsulina | "">("");
  // Valor del <select> de marca: "" | marca conocida | "no_se" | "otra".
  const [marcaDraft, setMarcaDraft] = useState("");
  const [marcaLibre, setMarcaLibre] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    const anioNum = anio.trim() ? parseInt(anio, 10) : NaN;
    const pesoNum = peso.trim() ? parseFloat(peso) : NaN;
    const alturaNum = altura.trim() ? parseInt(altura, 10) : NaN;
    startTransition(async () => {
      await actualizarPerfil({
        nombre: nombre.trim() ? nombre.trim() : null,
        tipoDiabetes,
        anioNacimiento: Number.isInteger(anioNum) ? anioNum : null,
        sexo,
        pesoKg: Number.isFinite(pesoNum) ? pesoNum : null,
        alturaCm: Number.isInteger(alturaNum) ? alturaNum : null,
      });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    });
  }

  function marcaFinal(): string {
    if (marcaDraft === "otra") return marcaLibre.trim();
    if (marcaDraft === "no_se" || marcaDraft === "") return "";
    return marcaDraft;
  }

  function onAgregar() {
    if (!claseDraft) return;
    startTransition(async () => {
      await agregarInsulina(claseDraft, marcaFinal());
      setClaseDraft("");
      setMarcaDraft("");
      setMarcaLibre("");
    });
  }

  function onEliminar(id: string) {
    startTransition(async () => {
      await eliminarInsulina(id);
    });
  }

  const marcasClase = claseDraft ? marcasDeClase(claseDraft) : [];

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FFFFFF",
        maxWidth: 480,
        margin: "0 auto",
        padding: "0 0 40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: AZUL,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link href="/chat" style={{ color: "#FFFFFF", fontSize: 22, textDecoration: "none" }}>
          ←
        </Link>
        <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 17, margin: 0 }}>
          Tu perfil
        </p>
      </div>

      <div style={{ padding: "20px 16px" }}>
        <p style={{ color: MUTED, fontSize: 13, margin: "0 0 24px", lineHeight: 1.5 }}>
          Esto ayuda a Gluco a acompañarte mejor. Podés cambiar lo que quieras,
          cuando quieras — las cosas cambian.
        </p>

        {/* Nombre */}
        <Seccion titulo="¿Cómo querés que te llame?">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            maxLength={40}
            style={inputEstilo}
          />
        </Seccion>

        {/* Tipo de diabetes */}
        <Seccion titulo="Tipo de diabetes">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {OPCIONES_TIPO_DIABETES.map((o) => (
              <button
                key={o.valor}
                onClick={() =>
                  setTipoDiabetes((prev) => (prev === o.valor ? null : o.valor))
                }
                style={opcionBtn(tipoDiabetes === o.valor)}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
        </Seccion>

        {/* Año */}
        <Seccion titulo="Año de nacimiento">
          <input
            type="number"
            inputMode="numeric"
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            placeholder="Ej: 1990"
            min={1900}
            max={2026}
            style={inputEstilo}
          />
        </Seccion>

        {/* Sexo */}
        <Seccion titulo="Sexo">
          <div style={{ display: "flex", gap: 10 }}>
            {OPCIONES_SEXO.map((o) => (
              <button
                key={o.valor}
                onClick={() =>
                  setSexo((prev) => (prev === o.valor ? null : o.valor))
                }
                style={{ ...opcionBtn(sexo === o.valor), flex: 1, fontSize: 13 }}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
        </Seccion>

        {/* Peso y altura */}
        <Seccion titulo="Peso y altura">
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="number"
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="Peso (kg)"
              min={20}
              max={400}
              style={{ ...inputEstilo, flex: 1 }}
            />
            <input
              type="number"
              inputMode="numeric"
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
              placeholder="Altura (cm)"
              min={50}
              max={250}
              style={{ ...inputEstilo, flex: 1 }}
            />
          </div>
        </Seccion>

        {/* Guardar perfil */}
        <button
          onClick={guardar}
          disabled={pending}
          style={{
            ...primaryBtn,
            backgroundColor: guardado ? EXITO : AZUL,
            opacity: pending ? 0.7 : 1,
          }}
        >
          {guardado ? "✓ Guardado" : pending ? "Guardando…" : "Guardar cambios"}
        </button>

        {/* Insulinas */}
        <div style={{ marginTop: 32 }}>
          <Seccion titulo="Tus insulinas">
            {insulinas.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13, margin: "0 0 12px" }}>
                No cargaste ninguna. Si usás insulina, agregala para que Gluco
                pueda hablarte de las tuyas.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {insulinas.map((i) => {
                  const etiqueta =
                    OPCIONES_CLASE_INSULINA.find((o) => o.valor === i.clase)
                      ?.etiqueta ?? i.clase;
                  return (
                    <div
                      key={i.id}
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
                        onClick={() => onEliminar(i.id)}
                        disabled={pending}
                        aria-label="Quitar insulina"
                        style={{ ...linkBtn(MUTED), fontSize: 18, padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Alta: clase → marca (dropdown taxativo + Otra / No sé) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select
                value={claseDraft}
                onChange={(e) => {
                  setClaseDraft(e.target.value as ClaseInsulina | "");
                  setMarcaDraft("");
                  setMarcaLibre("");
                }}
                style={{ ...inputEstilo, color: claseDraft ? TEXTO : MUTED }}
              >
                <option value="">Agregar una insulina…</option>
                {OPCIONES_CLASE_INSULINA.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta} — {o.ayuda}
                  </option>
                ))}
              </select>

              {claseDraft && (
                <select
                  value={marcaDraft}
                  onChange={(e) => setMarcaDraft(e.target.value)}
                  style={{ ...inputEstilo, color: marcaDraft ? TEXTO : MUTED }}
                >
                  <option value="">Marca (opcional)…</option>
                  {marcasClase.map((m) => (
                    <option key={m.marca} value={m.marca}>
                      {m.marca}
                    </option>
                  ))}
                  <option value="no_se">No sé la marca</option>
                  <option value="otra">Otra (escribir)</option>
                </select>
              )}

              {claseDraft && marcaDraft === "otra" && (
                <input
                  type="text"
                  value={marcaLibre}
                  onChange={(e) => setMarcaLibre(e.target.value)}
                  placeholder="¿Cuál?"
                  maxLength={80}
                  style={inputEstilo}
                />
              )}

              <button
                onClick={onAgregar}
                disabled={!claseDraft || pending}
                style={{
                  ...secondaryBtn,
                  opacity: claseDraft && !pending ? 1 : 0.5,
                  cursor: claseDraft && !pending ? "pointer" : "not-allowed",
                }}
              >
                + Agregar insulina
              </button>
            </div>
          </Seccion>
        </div>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2
        style={{
          color: TEXTO,
          fontSize: 15,
          fontWeight: 700,
          margin: "0 0 12px",
        }}
      >
        {titulo}
      </h2>
      {children}
    </div>
  );
}

const inputEstilo: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: `1px solid ${BORDE}`,
  borderRadius: 10,
  fontSize: 15,
  color: TEXTO,
  backgroundColor: "#F8FAFC",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px 0",
  border: "none",
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 700,
  color: "#FFFFFF",
  cursor: "pointer",
  minHeight: 44,
  transition: "background-color 0.2s",
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
    padding: "12px",
    borderRadius: 12,
    border: `1.5px solid ${activo ? AZUL : BORDE}`,
    backgroundColor: activo ? AZUL_AIRE : "#F8FAFC",
    color: TEXTO,
    fontSize: 14,
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
