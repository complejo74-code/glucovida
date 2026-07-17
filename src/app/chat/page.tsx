"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { detectarGlucosa } from "@/lib/agents/seguridad";
import { signOut } from "@/app/login/actions";

type Message = {
  role: "user" | "assistant";
  content: string;
};

/** Saludo inicial de Gluco. Mientras sea el único mensaje, mostramos el estado
 *  vacío cálido con chips de arranque (spec 10B-3 R8). */
const SALUDO_INICIAL: Message = {
  role: "assistant",
  content:
    "Hola, soy Gluco 👋 Estoy acá para acompañarte. ¿Cómo venís hoy?",
};

/** Chips de arranque (R8): puertas de entrada cálidas, en la voz de la persona.
 *  Al tocarlos se envían como un mensaje más — misma lógica que escribir. */
const CHIPS_ARRANQUE = [
  "Quiero anotar una glucemia",
  "Tengo una duda",
  "Contame algo útil para hoy",
] as const;

/**
 * Estado de rango de una glucemia detectada, para el chip (R3).
 * Excepción consciente al uso de los colores semánticos (ver docs/BRANDING.md §3):
 * el color acompaña SIEMPRE a un ícono + texto factual ("Baja/En rango/Alta"),
 * nunca juzga a la persona y jamás va solo (daltonismo, WCAG 1.4.1). El texto va
 * oscuro sobre el color al 10% para pasar AA; el color vive en borde + ícono.
 */
type EstadoGlucosa = {
  label: string;
  icono: string;
  clases: string;
  aria: string;
};

function estadoGlucosa(valor: number): EstadoGlucosa {
  if (valor < 70) {
    return {
      label: "Baja",
      icono: "🔻",
      clases: "border-danger bg-danger/10",
      aria: `Glucemia ${valor} mg por decilitro, por debajo del rango.`,
    };
  }
  if (valor <= 180) {
    return {
      label: "En rango",
      icono: "✅",
      clases: "border-success bg-success/10",
      aria: `Glucemia ${valor} mg por decilitro, en rango.`,
    };
  }
  return {
    label: "Alta",
    icono: "🔺",
    clases: "border-warning bg-warning/10",
    aria: `Glucemia ${valor} mg por decilitro, por encima del rango.`,
  };
}

/** Chip de glucemia (R3). Se alinea con la burbuja de quien lo reportó. */
function ChipGlucemia({
  valor,
  alineado,
}: {
  valor: number;
  alineado: "user" | "gluco";
}) {
  const estado = estadoGlucosa(valor);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-bold text-text",
        alineado === "user" ? "self-end" : "self-start",
        estado.clases
      )}
    >
      <span aria-hidden>{estado.icono}</span>
      <span aria-hidden>
        {valor} mg/dl · {estado.label}
      </span>
      <span className="sr-only">{estado.aria}</span>
    </span>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([SALUDO_INICIAL]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);

  // Scroll suave al último mensaje (o al indicador de "escribiendo"), sin saltos
  // bruscos (edge case: historial largo). Se dispara con cada mensaje y con el
  // loading para que el indicador quede a la vista. Acotado al contenedor de
  // mensajes (scrollTo sobre <main>) para que NUNCA scrollee la ventana: con el
  // teclado abierto, scrollIntoView burbujeaba al documento y arrastraba el
  // header fuera de la pantalla hasta el próximo render.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // ── LÓGICA INTACTA (R9) ────────────────────────────────────────────────────
  // La llamada a /api/chat, el manejo de errores y el shape del body no cambian.
  // El único agregado es el parámetro opcional `texto`, para que los chips de
  // arranque envíen sin pasar por el input. Cero cambios en el servidor.
  async function sendMessage(texto?: string) {
    const text = (texto ?? input).trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Ups, tuve un problema de conexión. ¿Podés intentar de nuevo?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  const sinConversacion = messages.length === 1;
  const enviarDeshabilitado = !input.trim() || loading;

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col bg-gradient-section sm:border-x sm:border-border">
      {/* ── Header (R6): sutil, sin métricas, "no es un dashboard" ── */}
      <header className="flex items-center gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
        <div
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-circle bg-primary-air text-xl"
        >
          🩵
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-extrabold leading-title text-text">
            Gluco
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span
              aria-hidden
              className="size-2 rounded-circle bg-success"
            />
            En línea
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/perfil">Perfil</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      {/* Disclaimer médico (siempre presente, tono cálido) */}
      <p className="border-b border-border bg-warning/10 px-4 py-2 text-center text-xs leading-body text-text">
        Gluco acompaña y educa, no reemplaza a tu equipo médico.
      </p>

      {/* ── Mensajes: contenedor anunciado a lectores de pantalla (R7) ── */}
      <main
        ref={scrollRef}
        aria-label="Conversación con Gluco"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5"
      >
        {/* Región de log: mantiene <main> como landmark y anuncia los mensajes
            nuevos (y el "escribiendo") de forma polite, sin interrumpir (R7). */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="flex flex-col gap-3"
        >
        {messages.map((msg, i) => {
          const esUsuario = msg.role === "user";
          // Chip consistente en TODO el historial (edge case): se recalcula por
          // render con el detector puro, así viejos y nuevos se ven igual. Solo
          // sobre lo que reporta la persona (mensajes del usuario).
          const glucosa = esUsuario ? detectarGlucosa(msg.content) : null;
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-1",
                esUsuario ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-bubble px-4 py-2.5 text-base leading-body",
                  esUsuario
                    ? "rounded-br-[6px] bg-gradient-primary text-primary-foreground"
                    : "rounded-bl-[6px] bg-primary-air text-text"
                )}
              >
                {msg.content}
              </div>
              {glucosa !== null && (
                <ChipGlucemia valor={glucosa} alineado="user" />
              )}
            </div>
          );
        })}

        {/* Estado vacío cálido con chips de arranque (R8) */}
        {sinConversacion && (
          <div className="mt-1 flex animate-fade-slide-in flex-col gap-3">
            <p className="max-w-[85%] text-sm leading-body text-muted">
              Estás en tu espacio. Escribile a Gluco lo que quieras — una duda,
              cómo venís hoy, lo que sea.
            </p>
            <div className="flex flex-wrap gap-2">
              {CHIPS_ARRANQUE.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => sendMessage(chip)}
                  className="min-h-11 rounded-pill border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-primary-soft hover:bg-primary-air focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Indicador "Gluco está escribiendo" — tres puntos con blink (R4) */}
        {loading && (
          <div className="flex items-start">
            <div className="flex items-center gap-1.5 rounded-bubble rounded-bl-[6px] bg-primary-air px-4 py-3.5">
              <span className="sr-only">Gluco está escribiendo…</span>
              <span
                aria-hidden
                className="size-2 animate-typing-dot rounded-circle bg-primary-strong"
              />
              <span
                aria-hidden
                className="size-2 animate-typing-dot rounded-circle bg-primary-strong [animation-delay:180ms]"
              />
              <span
                aria-hidden
                className="size-2 animate-typing-dot rounded-circle bg-primary-strong [animation-delay:360ms]"
              />
            </div>
          </div>
        )}
        </div>
      </main>

      {/* ── Composer (R5): textarea tokenizado + botón enviar circular celeste ── */}
      {/* pb con safe-area + dvh en el contenedor → el teclado no tapa el input (R10). */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-border bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribile a Gluco…"
          rows={1}
          aria-label="Escribí tu mensaje"
          className="flex max-h-28 min-h-11 w-full resize-none rounded-input border border-border-strong bg-white px-4 py-2.5 text-base text-text transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong"
        />
        <Button
          type="submit"
          size="icon"
          disabled={enviarDeshabilitado}
          aria-label="Enviar mensaje"
        >
          <Send aria-hidden />
        </Button>
      </form>
    </div>
  );
}
