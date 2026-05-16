export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AR: [-34.996, -64.967],
  AU: [-25.274, 133.775],
  AT: [47.516, 14.55],
  BE: [50.504, 4.47],
  BR: [-14.235, -51.925],
  BG: [42.734, 25.486],
  CA: [56.13, -106.347],
  CL: [-35.675, -71.543],
  CO: [4.571, -74.297],
  HR: [45.1, 15.2],
  CZ: [49.818, 15.473],
  DK: [56.264, 9.502],
  EE: [58.595, 25.014],
  FI: [61.924, 25.748],
  FR: [46.228, 2.214],
  DE: [51.166, 10.452],
  GR: [39.074, 21.824],
  HK: [22.319, 114.169],
  HU: [47.163, 19.503],
  IE: [53.413, -8.244],
  IT: [41.872, 12.567],
  JP: [36.205, 138.253],
  LV: [56.88, 24.603],
  LT: [55.169, 23.881],
  LU: [49.815, 6.13],
  MX: [23.635, -102.553],
  NL: [52.133, 5.291],
  NZ: [-40.901, 174.886],
  NO: [60.472, 8.469],
  PY: [-23.443, -58.444],
  PE: [-9.19, -75.015],
  PL: [51.919, 19.145],
  PT: [39.4, -8.225],
  RO: [45.943, 24.967],
  RU: [61.524, 105.319],
  RS: [44.017, 21.006],
  SG: [1.352, 103.82],
  SK: [48.669, 19.699],
  SI: [46.151, 14.995],
  ZA: [-30.56, 22.938],
  KR: [35.908, 127.767],
  ES: [40.464, -3.749],
  SE: [60.128, 18.644],
  CH: [46.818, 8.228],
  TR: [38.964, 35.243],
  GB: [55.378, -3.436],
  US: [39.828, -98.58],
  UY: [-32.523, -55.766],
};

export const COUNTRY_NAME_CENTROIDS: Record<string, [number, number]> = {
  'Hong Kong SAR China': COUNTRY_CENTROIDS.HK,
  'United Kingdom': COUNTRY_CENTROIDS.GB,
  'United States': COUNTRY_CENTROIDS.US,
};

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === '' || lng === '') return false;
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

export function countryCentroid(code?: string | null, name?: string | null): [number, number] | null {
  if (code && COUNTRY_CENTROIDS[code]) return COUNTRY_CENTROIDS[code];
  if (name && COUNTRY_NAME_CENTROIDS[name]) return COUNTRY_NAME_CENTROIDS[name];
  return null;
}
