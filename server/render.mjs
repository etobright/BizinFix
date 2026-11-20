import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const entryPoint = fileURLToPath(new URL('../src/video/index.tsx', import.meta.url));
let bundlePromise;
let queue = Promise.resolve();

export function scheduleRender(job, project, origin, outputDirectory) {
  queue = queue.then(async () => {
    job.status = 'rendering';
    job.progress = 0.02;
    try {
      bundlePromise ??= bundle({
        entryPoint,
        onProgress: (p) => {
          job.progress = 0.02 + p * 0.001;
        },
      });
      const serveUrl = await bundlePromise.catch((error) => {
        bundlePromise = undefined;
        throw error;
      });
      const inputProps = { project, origin };
      const browser = {
        browserExecutable: process.env.STUDIO_CHROMIUM || null,
        chromiumOptions: { gl: process.env.STUDIO_GL || 'swangle' },
      };
      const composition = await selectComposition({
        serveUrl,
        id: 'BizinfixDemo',
        inputProps,
        ...browser,
      });
      const output = join(outputDirectory, job.id + '.' + job.format);
      job.progress = 0.15;
      if (job.format === 'png') {
        const frame = Math.min(Math.round(project.fps * 0.45), composition.durationInFrames - 1);
        await renderStill({
          composition,
          serveUrl,
          inputProps,
          output,
          frame,
          imageFormat: 'png',
          ...browser,
        });
      } else {
        await renderMedia({
          composition,
          serveUrl,
          inputProps,
          codec: 'h264',
          pixelFormat: 'yuv420p',
          outputLocation: output,
          concurrency: 2,
          ...browser,
          onProgress: ({ progress }) => {
            job.progress = 0.15 + 0.84 * progress;
          },
        });
      }
      job.progress = 1;
      job.status = 'done';
    } catch (error) {
      console.error(error);
      job.status = 'error';
      job.error = error instanceof Error ? error.message : String(error);
    }
  });
}
