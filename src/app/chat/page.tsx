"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "@/app/login/actions";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola, soy Gluco 👋 Tu asistente de glucemia. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
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

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#22A7E6",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "#D6EEFB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🩵
        </div>
        <div>
          <p
            style={{
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 16,
              margin: 0,
            }}
          >
            Gluco
          </p>
          <p style={{ color: "#D6EEFB", fontSize: 13, margin: 0 }}>
            Asistente de glucemia
          </p>
        </div>
        <form action={signOut} style={{ marginLeft: "auto" }}>
          <button
            type="submit"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 8,
              color: "#FFFFFF",
              fontSize: 13,
              padding: "6px 12px",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Salir
          </button>
        </form>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          backgroundColor: "#FFF8E1",
          borderBottom: "1px solid #F59E0B",
          padding: "8px 16px",
          fontSize: 12,
          color: "#92400E",
          textAlign: "center",
        }}
      >
        Gluco acompaña y educa, no reemplaza a tu equipo médico.
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "78%",
                padding: "10px 14px",
                borderRadius:
                  msg.role === "user"
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                backgroundColor:
                  msg.role === "user" ? "#22A7E6" : "#F1F5F9",
                color: msg.role === "user" ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "18px 18px 18px 4px",
                backgroundColor: "#F1F5F9",
                color: "#5B6B7C",
                fontSize: 15,
              }}
            >
              Gluco está escribiendo...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #E6EEF5",
          backgroundColor: "#FFFFFF",
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribile a Gluco..."
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #E6EEF5",
            borderRadius: 20,
            padding: "10px 16px",
            fontSize: 15,
            color: "#0F172A",
            outline: "none",
            fontFamily: "inherit",
            backgroundColor: "#F8FAFC",
            maxHeight: 100,
            overflow: "auto",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: "50%",
            backgroundColor:
              !input.trim() || loading ? "#E6EEF5" : "#22A7E6",
            color: !input.trim() || loading ? "#5B6B7C" : "#FFFFFF",
            border: "none",
            fontSize: 18,
            cursor: !input.trim() || loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background-color 0.2s",
          }}
          aria-label="Enviar mensaje"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
