# Diseño frontend - Sistema de reservas

## Summary

Definir un frontend único para vender el sistema tanto a restaurantes chicos como grandes, con una identidad base **editorial sobria, cálida y premium**, pero preparada para cambiar por restaurante mediante branding.

La app tendrá dos experiencias conectadas por el mismo design system:

- **Booking público `/r/[slug]`**: mobile-first, rápido, claro, con foco en completar la reserva.
- **Panel staff `/admin`**: app de trabajo, escaneable, densa y eficiente para agenda, clientes y configuración.

## Key changes

### Dirección visual base

- Tipografía elegante y legible, evitando estética SaaS genérica.
- Paleta neutra cálida con acentos configurables por restaurante.
- Uso de fotos, logo y branding del restaurante en el booking público.
- Componentes compactos y funcionales para el panel.

### Sistema de componentes compartidos

- Botones, inputs, tabs, segmented controls, calendars, time slots, badges de estado, empty states y modales.
- CSS variables para `brand`, `surface`, `accent`, `radius`, `font` y estados.
- Estados claros para loading, error, slot ocupado, reserva confirmada y agenda vacía.

### Booking wizard

- Pasos: comensales, fecha, horario, zona/experiencia si aplica, datos, pedidos especiales y confirmación.
- Estado en URL como ya define la arquitectura.
- En mobile, navegación de un paso por pantalla.
- En desktop, resumen lateral fijo.

### Panel staff

- Dashboard principal como agenda del día.
- Vista por lista/turno con filtros por fecha, zona y estado.
- Acciones rápidas: sentar, completar, cancelar, no-show y agregar reserva manual.
- Configuración progresiva: simple para local chico, avanzada para zonas, turnos, mesas, combos y excepciones.

### Adaptabilidad por tamaño de restaurante

- Defaults simples: una zona, sin combos, flujo casi automático.
- Modo avanzado: zonas, múltiples servicios, combos, pacing, excepciones y reasignación.

## Public interfaces

- Mantener las rutas ya especificadas:
  - `/r/[slug]` para booking público.
  - `/admin` para panel.
- Consumir la API existente:
  - `GET /r/{slug}`
  - `GET /r/{slug}/availability`
  - `POST /r/{slug}/reservations`
  - endpoints `/admin/*`
- El branding vendrá desde `restaurant.settings.branding` y se aplicará como CSS variables, sin forks por restaurante.

## Test plan

### Booking público

- Reserva completa exitosa.
- Sin horarios disponibles.
- Slot ocupado entre selección y confirmación.
- Restaurante con una sola zona.
- Restaurante con varias zonas/servicios.
- Validación mobile y desktop.

### Panel staff

- Agenda con reservas por estado.
- Filtros por fecha, zona y estado.
- Alta manual/walk-in.
- Cambio de estado de reserva.
- Configuración simple vs avanzada.

### UX

- Refresh y botón atrás conservan el estado del wizard.
- Textos no se rompen en mobile.
- Componentes mantienen densidad profesional en panel.
- Branding de un restaurante no rompe contraste ni layout.

## Assumptions

- El primer diseño/demo representará un sistema vendible para restaurantes chicos y grandes, no una marca única cerrada.
- La estética base será editorial sobria, con suficiente calidez gastronómica para el booking y suficiente densidad operativa para el panel.
- El MVP frontend debe priorizar booking web y panel mínimo vendible; WhatsApp queda visualmente previsto, pero no como flujo principal todavía.
