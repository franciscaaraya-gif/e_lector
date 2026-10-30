import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ordena un array de objetos que contienen nombres y apellidos de forma alfabética real.
 * Ignora tildes, mayúsculas y maneja correctamente la 'ñ' y números.
 */
export function sortPeople<T>(
  items: T[] | null | undefined,
  getFields: (item: T) => { nombres?: string; apellidos?: string }
): T[] {
  if (!items) return [];
  const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
  
  return [...items].sort((a, b) => {
    const fA = getFields(a);
    const fB = getFields(b);

    const apeA = fA.apellidos?.trim() || '';
    const apeB = fB.apellidos?.trim() || '';
    const nomA = fA.nombres?.trim() || '';
    const nomB = fB.nombres?.trim() || '';

    // Criterio: Campos vacíos siempre al final
    if (!apeA && apeB) return 1;
    if (apeA && !apeB) return -1;

    const result = collator.compare(apeA, apeB);
    if (result !== 0) return result;
    
    if (!nomA && nomB) return 1;
    if (nomA && !nomB) return -1;
    
    return collator.compare(nomA, nomB);
  });
}

/**
 * Formatea el nombre de una persona en el estándar institucional: "APELLIDOS Nombres"
 */
export function formatFullName(nombres?: string, apellidos?: string): string {
  const nom = nombres?.trim() || '';
  const ape = apellidos?.trim() || '';
  
  if (!ape && !nom) return 'Sin nombre';
  if (!ape) return nom;
  if (!nom) return ape.toUpperCase();
  
  return `${ape.toUpperCase()} ${nom}`;
}
