# Posicionamiento — Sistema de reservas

> Documento de estrategia. Define para quién es, contra qué compite y cuál es la bandera. No cambia el motor, el esquema ni la API ya diseñados: afina el front, las features de distribución y el mensaje.

## La bandera (el diferenciador)

**La reserva más rápida y sin fricción que existe.** Cero login obligatorio, cero DNI, cero seña, cero app que bajar. Tres toques y listo.

Esto no es una feature más: es *la* razón de ser del producto. La fricción es lo que hace que la gente abandone y termine diciendo "para esto llamo". Cada paso que sacamos es ventaja. El competidor no puede copiarlo fácil porque su modelo depende de lo contrario (validación de identidad, penalizaciones, app de descubrimiento).

## Cliente ideal (ICP)

Restaurantes que **ya tienen audiencia propia** y hoy gestionan las reservas a mano (WhatsApp, teléfono) y lo están sufriendo. Señales: Instagram activo con seguidores, gente que les escribe por WhatsApp para reservar, sin un sistema o con uno que les da más trabajo del que ahorra.

**Punto dulce**: el lugar que ya tiene llegada pero no tiene cómo convertirla en reservas sin fricción.

**Para quién NO es (todavía)**: un local sin presencia digital. A ese no le resolvemos que lo descubran, solo que conviertan. No es nuestro cliente inicial.

## La idea central

Somos la **capa de conversión sobre la audiencia que el restaurante ya tiene.** No somos una fuente de audiencia nueva. El restaurante ya tiene la gente (su Instagram, su WhatsApp); nosotros la convertimos en reservas sin que se caiga nadie en el camino.

Pitch en una línea: *"Vos ya tenés a la gente. Nosotros la convertimos en reservas, sin fricción."*

## Lo que NO somos (a propósito)

- **No somos un marketplace de descubrimiento.** No construimos una app de comensales ni reseñas ni catálogo. Esa es la pelea que no podemos ni queremos ganar, y el restaurante no la necesita: ya tiene su audiencia.
- **No somos un sistema de gestión (POS).** No competimos con lo que el restaurante ya usa para operar.
- **No tenemos bot conversacional de WhatsApp.** (Ver distribución: usamos auto-respuesta con link, mucho más simple.)
- **No cobramos seña ni penalizamos al comensal.** Es parte de la bandera, no una limitación.

## Distribución (feature de primera clase)

La reserva pasa siempre en nuestro flujo de tres toques; la distribución es cómo la gente llega a ese flujo, desde donde el restaurante ya la tiene:

- **Link para el bio de Instagram** — prolijo, branded, listo para pegar.
- **Botón "Reservar"** para embeber en la web del local.
- **QR** para la mesa, la puerta o el mostrador.
- **Auto-respuesta de WhatsApp**: cuando alguien le escribe "quiero reservar", el restaurante tiene configurada una respuesta automática que devuelve nuestro link. WhatsApp es solo el canal que reparte el link; la reserva ocurre en nuestro flujo sin fricción. Sin bot conversacional, sin pelear con plantillas de Meta.

Todo apunta al mismo flujo. El producto no es "un sistema de reservas más": es la forma más simple de que tu gente reserve, desde donde ya te encuentra.

## La UI es el producto

Como la bandera es la fricción cero, la calidad de la UI *es* la ventaja competitiva. Principios no negociables:

- **Mínimos pasos posibles.** Cada pantalla del flujo se justifica o se elimina. Si un dato no es imprescindible, no se pide.
- **Sin callejones sin salida.** Siempre hay un próximo paso claro; nunca un error que deja al comensal varado.
- **Mobile-first de verdad.** La reserva se hace desde el celular, de noche, apurado. Diseñado para el pulgar.
- **Rápido y con feedback instantáneo.** Nada de spinners largos ni esperas mudas. Cada toque responde.
- **Sin jerga, sin formularios largos, sin obligar cuenta.** El comensal nunca siente que "se registró".
- **Cómodo y amable.** Tono humano, copy claro, estados vacíos/error que acompañan en vez de frustrar.

**Métrica norte**: tiempo y cantidad de toques hasta confirmar la reserva. Si sube, algo se hizo mal. Es la vara con la que se mide cada decisión de diseño.

(La dirección visual fina — tipografía, color, craft — está en el prompt de producto final. Esta sección define el *qué* del UX; ese prompt define el *cómo* del estilo.)

## El paisaje competitivo (resumen)

- **Woki**: el más grande en Argentina, va amplio (reservas + WhatsApp con IA + menú QR + reseñas + analytics) y es también marketplace. Usa validación de DNI y sistemas de penalización/garantía. Está endosado por Fudo. **Su debilidad es nuestra bandera**: reservar ahí tiene fricción (pide de todo).
- **Meitre**: premium/alta gama, modelo con seña. Fricción aceptada por sus restaurantes top, resistida por el comensal.
- **Covermanager**: desembarcando, también con modelo de cobro de reservas.

Nuestro lugar: no competir de frente en su juego completo, sino plantarnos en el eje que ellos no pueden ocupar sin romper su modelo — **fricción cero, sin seña, desde la audiencia que el restaurante ya tiene.**

## Qué cambia y qué no

- **No cambia**: el motor de disponibilidad, el esquema, la API, el flujo sin fricción. Todo lo construido sirve igual.
- **Se afina**: el front (UX de fricción mínima como obsesión), las features de distribución (link, QR, auto-respuesta de WhatsApp), y el mensaje hacia el cliente ideal.
- **Se simplifica**: el WhatsApp deja de ser un bot conversacional y pasa a ser auto-respuesta con link — menos complejidad, mismo caso de uso cubierto.
