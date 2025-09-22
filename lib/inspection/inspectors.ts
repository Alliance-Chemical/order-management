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
