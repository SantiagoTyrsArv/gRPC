/** URL del backend. Se define en build con `VITE_API_URL` y nunca se hardcodea. */
export function getApiUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    throw new Error('Falta la variable VITE_API_URL (consulta apps/web/.env.example)');
  }
  return url.replace(/\/$/, '');
}
