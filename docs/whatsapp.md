# WhatsApp como canal de distribucion

La estrategia principal no es un bot conversacional: WhatsApp reparte el link y la reserva ocurre en el flujo publico de Mesa Clara.

## Uso recomendado

Configurar una auto-respuesta en WhatsApp Business para mensajes como "quiero reservar", "reserva" o "mesa":

```text
Hola! Para reservar, entra aca:
https://tu-dominio.com/r/{slug}

Es rapido: sin cuenta, DNI, sena ni app.
```

Ese link puede ser el mismo que se usa en Instagram, QR y web. Todo llega al flujo de reserva con disponibilidad real.

## Variables para notificaciones

Estas variables siguen siendo utiles si el restaurante quiere confirmaciones o recordatorios por WhatsApp:

- `WHATSAPP_PROVIDER`: `console` o `meta`.
- `WHATSAPP_API_VERSION`: version de Graph API, por ejemplo `v23.0`.
- `WHATSAPP_ACCESS_TOKEN`: token permanente de Meta con permisos de WhatsApp.
- `WHATSAPP_PHONE_NUMBER_ID`: ID del numero emisor en WhatsApp Manager.
- `WHATSAPP_APP_SECRET`: secreto de la app Meta para validar `x-hub-signature-256`.
- `WHATSAPP_VERIFY_TOKEN`: token que se copia en Meta al verificar el webhook.
- `WHATSAPP_ENABLE_NOTIFICATIONS`: crea confirmaciones y recordatorios por WhatsApp ademas de email.
- `WHATSAPP_TEMPLATE_CONFIRMATION`: nombre de plantilla aprobada para confirmacion.
- `WHATSAPP_TEMPLATE_REMINDER`: nombre de plantilla aprobada para recordatorio.
- `WHATSAPP_TEMPLATE_LANGUAGE`: codigo de idioma de la plantilla, por defecto `es_AR`.

Plantillas sugeridas:

```text
Tu reserva en {{1}} quedo confirmada para {{2}}.
Gestionarla: {{3}}
```

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

## Webhook conversacional opcional

El repo todavia conserva un webhook y un procesador conversacional para pruebas o clientes que lo pidan explicitamente:

```text
GET/POST https://tu-dominio.com/api/v1/whatsapp/webhook
```

Para activarlo:

- `OPENAI_API_KEY`: activa interpretacion con IA.
- `OPENAI_BASE_URL`: base URL opcional compatible con OpenAI.
- `WHATSAPP_AI_PROVIDER`: `openai` para IA o `rules` para fallback deterministico.
- `WHATSAPP_AI_MODEL`: modelo para extraccion estructurada.
- `WHATSAPP_DEFAULT_RESTAURANT_SLUG`: tenant local/default para un unico numero.

Para varios restaurantes, guardar en `restaurant.settings`:

```json
{
  "whatsapp": {
    "enabled": true,
    "phoneNumberId": "1234567890"
  }
}
```

Importante: este flujo es secundario. La experiencia comercial por defecto debe vender auto-respuesta con link, porque reduce complejidad y mantiene la promesa de cero friccion.
