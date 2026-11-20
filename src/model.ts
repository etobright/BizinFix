export const formats = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] } as const;
export type Format = keyof typeof formats;
export type Asset = { id: string; name: string; kind: 'video' | 'image' | 'audio'; duration?: number };
export type ExampleScreen = { brand: string; heading: string; rows: string[]; action: string };
export type Scene = {
  id: string;
  title: string;
  subtitle: string;
  seconds: number;
  motion: 'orbit' | 'zoom' | 'slide' | 'still';
  asset?: string;
  example?: ExampleScreen;
  camera?: CameraMove;
};
export type Project = {
  id: string;
  name: string;
  format: Format;
  fps: 30 | 60;
  background: string;
  accent: string;
  font: string;
  scenes: Scene[];
  assets: Asset[];
  music?: string;
  voice?: string;
  logo?: string;
  mockup?: MockupStyle;
};
export const newScene = (): Scene => ({
  id: crypto.randomUUID(),
  title: 'Your home.\nHandled.',
  subtitle: 'Book trusted local pros in minutes.',
  seconds: 6,
  motion: 'orbit',
});
export const newMockupScene = (): Scene => ({
  ...newScene(),
  title: 'Bizinfix',
  subtitle: '',
  example: {
    brand: 'Bizinfix',
    heading: 'Réserver un service',
    rows: ['Plomberie', 'Électricité', 'Entretien'],
    action: 'Voir les disponibilités',
  },
  camera: presetMove(cameraPresets[0]),
});
export const createProject = (name = 'Mockup Bizinfix'): Project => ({
  id: crypto.randomUUID(),
  name,
  format: '9:16',
  fps: 30,
  background: '#101d18',
  accent: '#caff63',
  font: 'Arial',
  mockup: { ...defaultMockup },
  scenes: [newMockupScene()],
  assets: [],
});
export const frames = (p: Project) =>
  p.scenes.reduce((sum, s) => sum + Math.round(s.seconds * p.fps), 0);
export const assetUrl = (id: string, origin = '') => origin + '/api/media/' + id;

export type CameraPose = {
  yaw: number;
  pitch: number;
  roll: number;
  zoom: number;
  x: number;
  y: number;
};
export type CameraMove = { start: CameraPose; end: CameraPose; easing: 'smooth' | 'linear' };
export type MockupStyle = {
  device: 'iphone' | 'android';
  finish: 'graphite' | 'silver' | 'green';
  light: 'studio' | 'soft' | 'rim';
  backdrop: 'gradient' | 'solid';
  caption: boolean;
};

export const defaultPose: CameraPose = { yaw: -20, pitch: 8, roll: -8, zoom: 100, x: 0, y: 0 };
export const defaultMockup: MockupStyle = {
  device: 'iphone',
  finish: 'graphite',
  light: 'studio',
  backdrop: 'gradient',
  caption: false,
};

export const cameraPresets = [
  {
    id: 'turn',
    name: 'Rotation produit',
    detail: 'Un arc de caméra autour du téléphone',
    start: { yaw: -32, roll: -10 },
    end: { yaw: 26, pitch: 2, roll: 3 },
  },
  {
    id: 'close',
    name: 'Zoom écran',
    detail: 'Un rapprochement sur l’interface',
    start: { zoom: 82, yaw: -13 },
    end: { zoom: 135, yaw: 0, pitch: 0, roll: 0 },
  },
  {
    id: 'slide',
    name: 'Entrée latérale',
    detail: 'Le téléphone glisse vers le centre',
    start: { x: -75, yaw: -36, zoom: 84 },
    end: { x: 0, yaw: -14, zoom: 104 },
  },
  {
    id: 'tilt',
    name: 'Bascule',
    detail: 'Une révélation verticale de l’écran',
    start: { pitch: 48, yaw: -23, zoom: 87 },
    end: { pitch: 0, yaw: -5, roll: 0, zoom: 108 },
  },
  {
    id: 'front',
    name: 'Face caméra',
    detail: 'Un écran fixe, droit et lisible',
    start: { yaw: 0, pitch: 0, roll: 0 },
    end: { yaw: 0, pitch: 0, roll: 0 },
  },
] satisfies {
  id: string;
  name: string;
  detail: string;
  start: Partial<CameraPose>;
  end: Partial<CameraPose>;
}[];

export function presetMove(preset: (typeof cameraPresets)[number]): CameraMove {
  return {
    start: { ...defaultPose, ...preset.start },
    end: { ...defaultPose, ...preset.end },
    easing: 'smooth',
  };
}
