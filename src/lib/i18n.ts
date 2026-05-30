export type Locale = "es" | "en";

export const dictionaries = {
  es: {
    reserve: "Reservar",
    party: "Comensales",
    date: "Fecha",
    time: "Horario",
    zone: "Zona",
    details: "Datos",
    requests: "Pedidos",
    confirm: "Confirmar",
    name: "Nombre",
    email: "Email",
    phone: "Telefono",
    specialRequests: "Requerimientos especiales",
    noSlots: "No hay horarios disponibles",
    confirmed: "Reserva confirmada",
    admin: "Panel",
    agenda: "Agenda",
    settings: "Configuracion",
    customers: "Clientes",
    login: "Ingresar",
    logout: "Salir",
    save: "Guardar",
    cancel: "Cancelar",
    status: "Estado"
  },
  en: {
    reserve: "Book",
    party: "Guests",
    date: "Date",
    time: "Time",
    zone: "Area",
    details: "Details",
    requests: "Requests",
    confirm: "Confirm",
    name: "Name",
    email: "Email",
    phone: "Phone",
    specialRequests: "Special requests",
    noSlots: "No times available",
    confirmed: "Reservation confirmed",
    admin: "Dashboard",
    agenda: "Agenda",
    settings: "Settings",
    customers: "Customers",
    login: "Log in",
    logout: "Log out",
    save: "Save",
    cancel: "Cancel",
    status: "Status"
  }
} as const;

export function getLocale(value?: string | null): Locale {
  return value === "en" ? "en" : "es";
}

export function t(locale: Locale, key: keyof typeof dictionaries.es) {
  return dictionaries[locale][key];
}
