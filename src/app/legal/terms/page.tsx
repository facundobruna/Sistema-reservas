import { LegalSection, LegalShell } from "../_components";

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terminos de servicio"
      intro="Estas condiciones ordenan el uso de Mesa Clara por restaurantes, staff y comensales. No reemplazan acuerdos comerciales particulares firmados con un cliente."
    >
      <LegalSection title="Servicio">
        <p>Mesa Clara provee software para gestionar disponibilidad, reservas, waitlist, notificaciones, analitica operativa y canales como WhatsApp.</p>
        <p>El restaurante es responsable de mantener su configuracion, horarios, mesas, politicas internas y datos de contacto actualizados.</p>
      </LegalSection>
      <LegalSection title="Reservas">
        <p>La reserva queda sujeta a disponibilidad real, reglas del restaurante y posibles cambios operativos. Mesa Clara evita doble-booking desde el sistema, pero el restaurante conserva el control de sala.</p>
        <p>Los comensales pueden modificar o cancelar desde el link de gestion cuando el restaurante habilita esa experiencia.</p>
      </LegalSection>
      <LegalSection title="Uso aceptable">
        <p>No se permite usar la plataforma para spam, scraping, accesos no autorizados, carga de datos falsos o acciones que afecten la operacion de otros tenants.</p>
        <p>Las credenciales de staff son personales. Cada restaurante debe retirar accesos cuando alguien deja de operar el panel.</p>
      </LegalSection>
      <LegalSection title="Facturacion B2B">
        <p>Las suscripciones se cobran al restaurante. El comensal no paga senas ni cargos de reserva desde Mesa Clara.</p>
        <p>Los limites por plan pueden aplicar sobre mesas, reservas mensuales y funcionalidades avanzadas sin bloquear el flujo publico del comensal.</p>
      </LegalSection>
      <LegalSection title="Cambios">
        <p>Podemos actualizar estos terminos para reflejar mejoras del producto, cambios regulatorios o nuevos proveedores. La version vigente sera la publicada en esta pagina.</p>
      </LegalSection>
    </LegalShell>
  );
}
