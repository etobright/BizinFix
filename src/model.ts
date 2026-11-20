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
};
export const newScene = (): Scene => ({
  id: crypto.randomUUID(),
  title: 'Your home.\nHandled.',
  subtitle: 'Book trusted local pros in minutes.',
  seconds: 6,
  motion: 'orbit',
});
export const createProject = (name = 'Bizinfix App Demo'): Project => ({
  id: crypto.randomUUID(),
  name,
  format: '16:9',
  fps: 30,
  background: '#101d18',
  accent: '#caff63',
  font: 'Arial',
  scenes: [newScene()],
  assets: [],
});
export const frames = (p: Project) =>
  p.scenes.reduce((sum, s) => sum + Math.round(s.seconds * p.fps), 0);
export const assetUrl = (id: string, origin = '') => origin + '/api/media/' + id;
