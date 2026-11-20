import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { assetUrl, type Project, type Scene } from '../model';
import { Phone } from './Phone';

export type DemoProps = { project: Project; origin?: string };
function Shot({
  project,
  scene,
  origin,
  index,
}: {
  project: Project;
  scene: Scene;
  origin: string;
  index: number;
}) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const portrait = height > width;
  const square = height === width;
  const u = Math.min(width, height) / 1080;
  const asset = project.assets.find((a) => a.id === scene.asset && a.kind !== 'audio');
  const reveal = interpolate(frame, [0, Math.round(fps * 0.42)], [0, 1], { extrapolateRight: 'clamp' });
  const entry =
    index === 0
      ? 1
      : interpolate(frame, [0, Math.round(fps * 0.24)], [0, 1], { extrapolateRight: 'clamp' });
  const end =
    project.scenes.length - 1 === index
      ? 1
      : interpolate(
          frame,
          [
            Math.round(scene.seconds * fps) - Math.round(fps * 0.28),
            Math.round(scene.seconds * fps) - 1,
          ],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
  const { accent, background } = project;
  return (
    <AbsoluteFill
      style={{
        opacity: entry * end,
        overflow: 'hidden',
        color: '#f7fbf7',
        fontFamily: project.font,
        background: `radial-gradient(ellipse at 75% 50%, ${accent}32, transparent 54%), ${background}`,
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.32,
          backgroundImage: `linear-gradient(${accent}18 1px, transparent 1px), linear-gradient(90deg,${accent}18 1px,transparent 1px)`,
          backgroundSize: `${58 * u}px ${58 * u}px`,
          maskImage: 'radial-gradient(ellipse at 72% 50%, black, transparent 78%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 665 * u,
          height: 665 * u,
          borderRadius: '50%',
          border: `1px solid ${accent}48`,
          boxShadow: `0 0 0 ${35 * u}px ${accent}0a,0 0 0 ${75 * u}px ${accent}0a`,
          left: portrait ? '50%' : square ? '69%' : '73%',
          top: portrait ? '66%' : '51%',
          transform: 'translate(-50%,-50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 72 * u,
          left: portrait ? 74 * u : width * 0.085,
          display: 'flex',
          alignItems: 'center',
          gap: 13 * u,
          fontSize: 34 * u,
          fontWeight: 800,
          letterSpacing: -u,
        }}
      >
        {project.logo ? (
          <Img
            src={assetUrl(project.logo, origin)}
            style={{ maxHeight: 52 * u, maxWidth: 230 * u, objectFit: 'contain' }}
          />
        ) : (
          <>
            <span
              style={{
                color: '#152219',
                background: accent,
                borderRadius: 12 * u,
                width: 48 * u,
                height: 48 * u,
                textAlign: 'center',
                lineHeight: `${48 * u}px`,
              }}
            >
              b
            </span>
            bizinfix
          </>
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          left: portrait ? 74 * u : width * 0.085,
          top: portrait ? '13%' : square ? '34%' : '30%',
          width: portrait ? '85%' : square ? '44%' : '44%',
          zIndex: 1,
          opacity: reveal,
          transform: `translateY(${(1 - reveal) * 32 * u}px)`,
        }}
      >
        <div
          style={{
            fontSize: 17 * u,
            fontWeight: 800,
            color: accent,
            letterSpacing: 4 * u,
            marginBottom: 22 * u,
          }}
        >
          {scene.example ? 'DÉMONSTRATION' : 'PRODUCT DEMO'}
        </div>
        <div
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            fontSize: (portrait ? 82 : square ? 63 : 112) * u,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -4 * u,
          }}
        >
          {scene.title.split('\n').map((line, i) => (
            <span key={i} style={{ display: 'block', color: i ? accent : undefined }}>
              {line}
            </span>
          ))}
        </div>
        <div
          style={{
            marginTop: 24 * u,
            fontSize: (square ? 26 : 32) * u,
            lineHeight: 1.3,
            color: '#d2dfd5',
            whiteSpace: 'pre-wrap',
          }}
        >
          {scene.subtitle}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: portrait ? 0 : square ? width * 0.4 : width * 0.45,
          top: portrait ? height * 0.38 : height * 0.036,
          filter: 'drop-shadow(0px 28px 30px #0008)',
        }}
      >
        <Phone
          width={Math.round(portrait ? width : width * 0.55)}
          height={Math.round(portrait ? height * 0.56 : height * 0.92)}
          scene={scene}
          asset={asset}
          src={asset ? assetUrl(asset.id, origin) : undefined}
          accent={accent}
        />
      </div>
    </AbsoluteFill>
  );
}
export function Demo({ project, origin = '' }: DemoProps) {
  let offset = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: project.background }}>
      {project.scenes.map((scene, index) => {
        const duration = Math.round(scene.seconds * project.fps);
        const from = offset;
        offset += duration;
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={duration}
            name={scene.title.replaceAll('\n', ' ')}
          >
            <Shot project={project} scene={scene} origin={origin} index={index} />
          </Sequence>
        );
      })}
      {project.music && (
        <Audio src={assetUrl(project.music, origin)} volume={project.voice?.length ? 0.22 : 0.55} loop />
      )}
      {project.voice && <Audio src={assetUrl(project.voice, origin)} />}
    </AbsoluteFill>
  );
}
