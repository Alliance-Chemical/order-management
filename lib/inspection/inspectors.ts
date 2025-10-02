export const INSPECTORS = [
  'Cruz',
  'Andy G.',
  'Adnan Heikal',
  'Andre Taki',
  'Dion',
  'Wayne',
  'Darriel',
] as const;

export type InspectorName = (typeof INSPECTORS)[number];

/**
 * Type guard to check if a string is a valid inspector name
 */
export function isInspectorName(value: string): value is InspectorName {
  return INSPECTORS.includes(value as InspectorName);
}
