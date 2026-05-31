# WhatsApp AI + Cloud API

La integracion usa un bot IA para interpretar mensajes naturales y el mismo motor de disponibilidad/reserva que el booking web. En local puede correr con `WHATSAPP_PROVIDER=console`; en produccion usa Meta Cloud API.

## Variables

- `OPENAI_API_KEY`: API key server-side para activar el bot IA.
- `OPENAI_BASE_URL`: base URL opcional compatible con OpenAI, por defecto `https://api.openai.com/v1`.
- `WHATSAPP_AI_PROVIDER`: `openai` para IA o `rules` para forzar el fallback deterministico.
- `WHATSAPP_AI_MODEL`: modelo para extraccion estructurada, por defecto `gpt-4o-mini`.
- `WHATSAPP_PROVIDER`: `console` o `meta`.
- `WHATSAPP_API_VERSION`: version de Graph API, por ejemplo `v23.0`.
- `WHATSAPP_ACCESS_TOKEN`: token permanente de Meta con permisos de WhatsApp.
- `WHATSAPP_PHONE_NUMBER_ID`: ID del numero emisor en WhatsApp Manager.
- `WHATSAPP_APP_SECRET`: secreto de la app Meta para validar `x-hub-signature-256`.
- `WHATSAPP_VERIFY_TOKEN`: token que se copia en Meta al verificar el webhook.
- `WHATSAPP_DEFAULT_RESTAURANT_SLUG`: tenant local/default para un unico numero.
- `WHATSAPP_ENABLE_NOTIFICATIONS`: crea confirmaciones y recordatorios por WhatsApp ademas de email.
- `WHATSAPP_TEMPLATE_CONFIRMATION`: nombre de plantilla aprobada para confirmacion.
- `WHATSAPP_TEMPLATE_REMINDER`: nombre de plantilla aprobada para recordatorio.
- `WHATSAPP_TEMPLATE_LANGUAGE`: codigo de idioma de la plantilla, por defecto `es_AR`.

Para varios restaurantes, guardar en `restaurant.settings`:

```json
{
  "whatsapp": {
    "enabled": true,
    "phoneNumberId": "1234567890"
  }
}
```

## Webhook

Configurar en Meta:

```text
GET/POST https://tu-dominio.com/api/v1/whatsapp/webhook
```

El `GET` responde el `hub.challenge` si `hub.verify_token` coincide con `WHATSAPP_VERIFY_TOKEN`. El `POST` procesa mensajes de texto del campo `messages`; los statuses de entrega se pueden agregar despues sin cambiar el contrato.

## Plantillas sugeridas

Las conversaciones iniciadas por el negocio fuera de la ventana de 24 horas requieren plantillas aprobadas por Meta. Sugerencia:

`mesa_clara_confirmation`

```text
Tu reserva en {{1}} quedo confirmada para {{2}}.
Gestionarla: {{3}}
```

`mesa_clara_reminder`

```text
Te recordamos tu reserva en {{1}} para {{2}}.
Gestionarla: {{3}}
```

El orden de variables que envia la app es:

```text
{{1}} restaurante
{{2}} fecha y hora local
{{3}} link de gestion
```

## Flujo conversacional

Con `OPENAI_API_KEY`, el bot interpreta lenguaje natural y extrae datos de reserva con salida estructurada. Ejemplos:

```text
Somos 4 para manana a la noche, cerca de la ventana.
Quiero una mesa para 2 el viernes a las 21.
La segunda opcion, a nombre de Facu.
```

El modelo devuelve intencion, fecha, cantidad, hora preferida, opcion elegida, nombre y pedidos especiales. La aplicacion valida esos datos contra disponibilidad real antes de crear la reserva.

Si no hay `OPENAI_API_KEY`, el fallback local mantiene el flujo basico:

1. `hola` o `reservar`
2. cantidad de personas
3. fecha: `hoy`, `manana`, `AAAA-MM-DD` o `DD/MM`
4. numero de opcion de horario
5. nombre, si no existe cliente previo

La reserva creada queda con `source='whatsapp'`, agenda notificaciones normales y ocupa inventario con el mismo constraint anti doble-booking que la web.
