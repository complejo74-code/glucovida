# BRANDING — Sistema de diseño de GlucoVida

> Este documento es la **fuente de verdad visual** de GlucoVida. Todo lo que se
> construya (paso 10B en adelante) se decide contra lo que dice acá. Los tokens
> viven en `tailwind.config.ts`; este doc explica el *porqué* de cada uno.

---

## 1. Esencia

La pregunta que guía **toda** decisión de diseño es una sola:

> **¿Esto hace que alguien se sienta acompañado, o monitoreado?**

Si la respuesta es *monitoreado*, se descarta. Sin excepción.

GlucoVida **NO es**:

- una app médica
- un dashboard
- un tracker

Es un espacio donde una persona con diabetes se siente **acompañada**. Cada
pantalla, cada color, cada palabra tiene que sostener esa sensación. Si algo
huele a panel de control clínico, está mal, aunque sea "más eficiente".

---

## 2. Modo

**LIGHT MODE PURO.**

- Sin dark mode.
- Sin fondos oscuros.
- **Nunca.**

No hay `@media (prefers-color-scheme: dark)`. No hay toggle. El fondo siempre
degrada hacia blanco. La luz es parte del mensaje: esto es un lugar amable, no
una sala de terapia intensiva.

---

## 3. Paleta

Los 11 colores del sistema. Nada de hex sueltos en el código: todo vía token.

| Token           | Hex       | Uso                                             |
|-----------------|-----------|-------------------------------------------------|
| `primary`       | `#22A7E6` | Celeste principal — acción, marca               |
| `primary-strong`| `#1D90C7` | Celeste fuerte — hover, fondo de gradiente       |
| `primary-soft`  | `#A9DDF7` | Celeste suave — acentos, estados                 |
| `primary-air`   | `#D6EEFB` | Celeste aire — fondos suaves, círculos de icono  |
| `white`         | `#FFFFFF` | Fondo base                                       |
| `text`          | `#0F172A` | Texto principal                                  |
| `muted`         | `#5B6B7C` | Texto secundario / apagado                       |
| `border`        | `#E6EEF5` | Bordes, divisores                                |
| `success`       | `#10B981` | Confirmaciones (nunca "bien" vs "mal" de salud)  |
| `warning`       | `#F59E0B` | Avisos suaves, disclaimers                       |
| `danger`        | `#EF4444` | Errores de sistema (no juicios de glucosa)       |

> `success`/`warning`/`danger` son para estados de **la app** (guardado, error de
> red, aviso). **Jamás** para calificar un valor de glucosa como bueno o malo.

---

## 4. Gradientes

El celeste **SIEMPRE** degrada hacia blanco. Nunca hacia un fondo oscuro.

- **Botón:**
  ```css
  linear-gradient(180deg, #22A7E6, #1D90C7)
  ```
- **Sección:**
  ```css
  linear-gradient(180deg, #D6EEFB 0%, #EBF6FD 55%, #FFFFFF 100%)
  ```

Tokens: `bg-gradient-primary` (botón) y `bg-gradient-section` (sección).

---

## 5. Tipografía

**Nunito** — redonda, cálida, humana. Cargada con `next/font` (self-hosted,
optimizada, sin `<link>` suelto).

- Weights disponibles: **400 / 600 / 700 / 800 / 900**.
- **Line-height:**
  - Títulos: `1.1`
  - Body: `1.75`

El aire entre líneas del body (1.75) es parte del tono: se lee tranquilo, sin
apuro, sin apretar.

---

## 6. Radios

Nada sharp. Todo redondeado.

| Token          | Valor   | Uso                                   |
|----------------|---------|---------------------------------------|
| `rounded-card` | `28px`  | Cards                                 |
| `rounded-input`| `14px`  | Campos de texto (intermedio, cómodo)  |
| `rounded-pill` | `999px` | Botones y pills                       |
| `rounded-circle` | `50%` | Círculos de icono                    |

> **Inputs** llevan un radio intermedio (`14px`), no pill: un campo de texto
> ancho totalmente redondeado (999px) se siente raro y aprieta el contenido. El
> pill queda para botones y toggles; el input respira con esquinas suaves.

---

## 7. Sombras

Siempre en tono **celeste**, nunca negras. Una sombra negra endurece; una
celeste envuelve.

- **Card hover:**
  ```css
  0 25px 50px rgba(34,167,230,0.08)
  ```
  Token: `shadow-card-hover`
- **Botón hover:**
  ```css
  0 15px 35px rgba(34,167,230,0.25)
  ```
  Token: `shadow-btn-hover`

---

## 8. Espaciado

Mucho aire. Mucho blanco. Nada saturado. El espacio en blanco no es "espacio
desperdiciado": es lo que hace que la pantalla respire y no agobie. Ante la duda,
más aire.

---

## 9. Tono de voz

Un **amigo con experiencia**, no un médico ni un algoritmo. Rioplatense: *vos,
sos, tenés*.

**Regla de oro:** JAMÁS juzgar un valor de glucosa. Ni "alto", ni "bajo malo",
ni "descontrolado". Se describe el movimiento, se acompaña, no se sentencia.

| En vez de…             | Decimos…                                                  |
|------------------------|-----------------------------------------------------------|
| "Nivel incorrecto"     | "Veamos qué pasó"                                         |
| "Valor anormal"        | "Tu glucosa está moviéndose"                             |
| "Error"                | "Algo no salió como esperábamos. ¿Probamos de nuevo?"    |
| Sesión expirada        | "Te extrañamos. Iniciá sesión para volver"               |

El tono no es decorativo: es la diferencia entre sentirse **acompañado** o
**monitoreado** (ver §1).
