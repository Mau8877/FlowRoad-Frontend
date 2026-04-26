export function formatBoliviaDate(value?: string | null): string {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/La_Paz',
  }).format(date);
}
