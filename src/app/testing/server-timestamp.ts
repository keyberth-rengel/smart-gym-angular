/**
 * Marca de tiempo tal como la envía el backend (LocalDateTime en UTC, sin zona) para el instante
 * cuya hora local es `localIso` ("yyyy-MM-ddTHH:mm:ss"). Así las pruebas no dependen de la zona de la máquina.
 */
export function serverTimestamp(localIso: string): string {
  return new Date(localIso).toISOString().slice(0, -1);
}
