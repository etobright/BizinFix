import express from 'express';
import multer from 'multer';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir, rename, unlink } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { scheduleRender } from './render.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const store = resolve(process.env.STUDIO_DATA_DIR || join(root, 'studio-data'));
const media = join(store, 'media');
const output = join(store, 'exports');
for (const dir of [media, output]) mkdirSync(dir, { recursive: true });
const port = Number(process.env.PORT || process.env.STUDIO_PORT || 4310);
const host = process.env.STUDIO_HOST || '127.0.0.1';
const password = process.env.STUDIO_ACCESS_PASSWORD;
if (host !== '127.0.0.1' && !password) {
  throw new Error('Configurez STUDIO_ACCESS_PASSWORD avant de publier le studio.');
}

const app = express();
app.get('/healthz', (req, res) => res.sendStatus(200));
if (password) {
  const credentials = Buffer.from('studio:' + password).toString('base64');
  const digest = (value) => createHash('sha256').update(value).digest();
  const expected = digest('Basic ' + credentials);
  app.use((req, res, next) => {
    if (timingSafeEqual(digest(req.get('Authorization') || ''), expected)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Bizinfix Video Studio", charset="UTF-8"');
    res.sendStatus(401);
  });
}
app.use(express.json({ limit: '2mb' }));
const kinds = {
  '.mp4': 'video',
  '.webm': 'video',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.m4a': 'audio',
  '.ogg': 'audio',
};
const upload = multer({ dest: media, limits: { fileSize: 500 * 1024 * 1024, files: 1 } });
const uuid = z.uuid();
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const schema = z.object({
  id: uuid,
  name: z.string().max(150),
  format: z.enum(['16:9', '9:16', '1:1']),
  fps: z.union([z.literal(30), z.literal(60)]),
  background: color,
  accent: color,
  font: z.enum(['Arial', 'Georgia', 'Trebuchet MS', 'Verdana']),
  assets: z
    .array(
      z.object({
        id: uuid,
        name: z.string().max(255),
        kind: z.enum(['video', 'image', 'audio']),
        duration: z.number().positive().optional(),
      }),
    )
    .max(500),
  scenes: z
    .array(
      z.object({
        id: uuid,
        title: z.string().max(250),
        subtitle: z.string().max(500),
        seconds: z.number().min(1).max(60),
        motion: z.enum(['orbit', 'zoom', 'slide', 'still']),
        asset: uuid.optional(),
        example: z
          .object({
            brand: z.string().max(40),
            heading: z.string().max(50),
            rows: z.array(z.string().max(55)).max(3),
            action: z.string().max(40),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(100),
  music: uuid.optional(),
  voice: uuid.optional(),
  logo: uuid.optional(),
});

app.post('/api/media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });
  const ext = extname(req.file.originalname).toLowerCase();
  const kind = Object.hasOwn(kinds, ext) ? kinds[ext] : undefined;
  if (!kind) {
    await unlink(req.file.path);
    return res.status(415).json({ error: 'Format de média non pris en charge.' });
  }
  const id = randomUUID();
  await rename(req.file.path, join(media, id + ext));
  res.status(201).json({ id, name: req.file.originalname, kind });
});
async function sendMedia(req, res) {
  if (!uuid.safeParse(req.params.id).success) return res.sendStatus(404);
  const file = (await readdir(media)).find((name) => name.startsWith(req.params.id + '.'));
  if (!file) return res.sendStatus(404);
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(join(media, file));
}
app.get('/api/media/:id', sendMedia);

// Chromium fetches media from a private listener without the studio login.
const renderMediaApp = express();
renderMediaApp.get('/api/media/:id', sendMedia);
const mediaServer = renderMediaApp.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  mediaServer.once('listening', resolve);
  mediaServer.once('error', reject);
});
const origin = 'http://127.0.0.1:' + mediaServer.address().port;

const jobs = new Map();
app.post('/api/renders', async (req, res) => {
  const request = z.object({ project: schema, format: z.enum(['mp4', 'png']) }).safeParse(req.body);
  if (!request.success) return res.status(400).json({ error: 'Paramètres de rendu invalides.' });
  const { project, format } = request.data;
  const files = new Map((await readdir(media)).map((file) => [file.slice(0, 36), kinds[extname(file)]]));
  const valid = (id, kinds) =>
    !id ||
    (kinds.includes(files.get(id)) &&
      project.assets.some((a) => a.id === id && a.kind === files.get(id)));
  if (
    !project.scenes.every((s) => valid(s.asset, ['video', 'image'])) ||
    !valid(project.logo, ['image']) ||
    !valid(project.music, ['audio']) ||
    !valid(project.voice, ['audio'])
  ) {
    return res.status(400).json({ error: 'Un média référencé est introuvable ou incompatible.' });
  }
  const job = { id: randomUUID(), status: 'queued', format, progress: 0 };
  jobs.set(job.id, job);
  scheduleRender(job, project, origin, output);
  res.status(202).json(job);
});
app.get('/api/renders/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.sendStatus(404);
  res.json(job);
});
app.get('/api/renders/:id/download', (req, res) => {
  const job = jobs.get(req.params.id);
  if (job?.status !== 'done') return res.sendStatus(404);
  res.download(join(output, job.id + '.' + job.format), 'bizinfix-demo.' + job.format);
});

const dist = join(root, 'dist');
if (existsSync(dist)) app.use(express.static(dist));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError)
    return res.status(400).json({ error: 'Import impossible. Taille maximale par fichier : 500 Mo.' });
  console.error(error);
  res
    .status(error.status || 500)
    .json({ error: 'Le serveur local n’a pas pu terminer cette opération.' });
});
app.listen(port, host, () => console.log('Bizinfix Video Studio écoute sur le port ' + port));
