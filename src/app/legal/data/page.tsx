import { PrivacyRequestForm } from "@/components/legal/privacy-request-form";
import { LegalSection, LegalShell } from "../_components";

export default function DataRightsPage() {
  return (
    <LegalShell
      eyebrow="Datos"
      title="Exportar o borrar datos"
      intro="Los comensales pueden pedir una copia de sus datos o solicitar borrado. Si usan el link de una reserva activa, las APIs de autoservicio resuelven la exportacion o anonimizacion."
    >
      <LegalSection title="Autoservicio con sesion">
        <p>
          <code>GET /api/v1/me/export</code> descarga los datos del comensal autenticado por cookie o token.
        </p>
        <p>
          <code>POST /api/v1/me/delete</code> con <code>{JSON.stringify({ confirm: true })}</code> registra la solicitud y anonimiza datos personales. Las reservas futuras activas se cancelan para liberar inventario.
        </p>
      </LegalSection>
      <LegalSection title="Solicitud manual">
        <p>Si no tenes el link o la sesion activa, deja email o telefono para que el restaurante ubique tu registro desde el panel.</p>
        <PrivacyRequestForm />
      </LegalSection>
    </LegalShell>
  );
}
