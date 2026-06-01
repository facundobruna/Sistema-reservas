import Link from "next/link";
import { LegalSection, LegalShell } from "../_components";

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Privacidad"
      title="Politica de privacidad"
      intro="Mesa Clara procesa datos minimos para operar reservas: identificar al comensal, avisarle cambios importantes y ayudar al restaurante a gestionar la sala."
    >
      <LegalSection title="Datos que tratamos">
        <p>Del comensal podemos guardar nombre, telefono, email opcional, reservas, pedidos especiales, waitlist y mensajes operativos enviados por canales conectados.</p>
        <p>Del staff guardamos identificacion, rol, restaurante asociado y acciones sensibles auditadas dentro del panel.</p>
      </LegalSection>
      <LegalSection title="Finalidad">
        <p>Usamos los datos para confirmar reservas, evitar doble-booking, enviar recordatorios, permitir cambios/cancelaciones y mostrar al restaurante informacion necesaria para operar.</p>
        <p>No vendemos datos personales ni los usamos para marketing de terceros.</p>
      </LegalSection>
      <LegalSection title="Proveedores">
        <p>Podemos usar proveedores de infraestructura, email, WhatsApp/Meta, pagos B2B y base de datos. Cada proveedor recibe solo lo necesario para prestar el servicio.</p>
      </LegalSection>
      <LegalSection title="Cookies">
        <p>Usamos cookies necesarias para sesiones, seguridad y continuidad de la reserva. Las cookies analiticas son opcionales y se guardan solo si aceptas el aviso.</p>
      </LegalSection>
      <LegalSection title="Derechos">
        <p>Podes pedir exportacion o borrado/anonimizacion de tus datos. Si tenes sesion de comensal, la exportacion puede descargarse desde la API; si no, registra una solicitud.</p>
        <p>
          Abrir formulario de datos:{" "}
          <Link className="font-semibold text-[var(--foreground)] underline-offset-4 hover:underline" href="/legal/data">
            solicitudes de privacidad
          </Link>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
