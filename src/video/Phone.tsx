import { useCallback, useEffect, useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { Video } from '@remotion/media';
import { useLoader, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import { Freeze, interpolate, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from 'remotion';
import {
  cameraPresets,
  presetMove,
  type Asset,
  type CameraPose,
  type ExampleScreen,
  type MockupStyle,
  type Scene,
} from '../model';

function rounded(w: number, h: number, r: number) {
  const x = -w / 2,
    y = -h / 2;
  const s = new Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const shell = new ExtrudeGeometry(rounded(2.11, 4.31, 0.24), {
  depth: 0.12,
  bevelEnabled: true,
  bevelSize: 0.045,
  bevelThickness: 0.035,
  bevelSegments: 4,
});
const androidShell = new ExtrudeGeometry(rounded(2.11, 4.31, 0.13), {
  depth: 0.12,
  bevelEnabled: true,
  bevelSize: 0.038,
  bevelThickness: 0.028,
  bevelSegments: 3,
});
const rearPlate = new ExtrudeGeometry(rounded(0.81, 0.84, 0.15), { depth: 0.033, bevelEnabled: false });
const rearRim = new ShapeGeometry(rounded(0.34, 0.34, 0.17));
const rearGlass = new ShapeGeometry(rounded(0.245, 0.245, 0.122));
const rearLenses = [
  [0.15, 0.19],
  [-0.18, -0.03],
  [0.15, -0.22],
] as const;
const screen = new ShapeGeometry(rounded(1.995, 4.19, 0.225));
const uv = screen.getAttribute('uv');
for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.995 + 0.5, uv.getY(i) / 4.19 + 0.5);
const island = new ShapeGeometry(rounded(0.52, 0.145, 0.072));
const button = new ExtrudeGeometry(rounded(0.055, 0.53, 0.027), { depth: 0.04, bevelEnabled: false });

function Screen({ texture }: { texture: Texture }) {
  const image = texture.image as HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;
  const fit = useMemo(() => ({ value: image.width / image.height / (1.995 / 4.19) }), [image]);
  const material = useMemo(() => ({ map: { value: texture }, fit }), [texture, fit]);
  return (
    <mesh geometry={screen} position={[0, 0, 0.158]}>
      <shaderMaterial
        uniforms={material}
        vertexShader={`
      varying vec2 screenUv;
      void main(){screenUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `}
        fragmentShader={`
      uniform sampler2D map; uniform float fit; varying vec2 screenUv;
      void main(){
        vec2 p=(screenUv-.5)*vec2(max(1.,1./fit),max(1.,fit))+.5;
        gl_FragColor=any(lessThan(p,vec2(0.)))||any(greaterThan(p,vec2(1.))) ? vec4(.01,.014,.012,1.) : texture2D(map,p);
        #include <colorspace_fragment>
      }
    `}
      />
    </mesh>
  );
}
function VideoScreen({ src }: { src: string }) {
  const { advance, invalidate } = useThree();
  const { isRendering } = useRemotionEnvironment();
  const buffer = useMemo(() => {
    const canvas = new OffscreenCanvas(600, 1260);
    const context = canvas.getContext('2d')!;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { canvas, context, texture };
  }, []);
  useEffect(() => () => buffer.texture.dispose(), [buffer]);
  const update = useCallback(
    (frame: CanvasImageSource) => {
      const [width, height] =
        frame instanceof VideoFrame
          ? [frame.displayWidth, frame.displayHeight]
          : frame instanceof HTMLVideoElement
            ? [frame.videoWidth, frame.videoHeight]
            : frame instanceof SVGImageElement
              ? [frame.width.baseVal.value, frame.height.baseVal.value]
              : [frame.width, frame.height];
      if (!width || !height) return;
      const scale = Math.min(buffer.canvas.width / width, buffer.canvas.height / height);
      const drawnWidth = width * scale;
      const drawnHeight = height * scale;
      buffer.context.fillStyle = '#111b16';
      buffer.context.fillRect(0, 0, buffer.canvas.width, buffer.canvas.height);
      buffer.context.drawImage(
        frame,
        (buffer.canvas.width - drawnWidth) / 2,
        (buffer.canvas.height - drawnHeight) / 2,
        drawnWidth,
        drawnHeight,
      );
      buffer.texture.needsUpdate = true;
      // Remotion can capture as soon as this callback completes.
      if (isRendering) advance(performance.now());
      else invalidate();
    },
    [buffer, isRendering, advance, invalidate],
  );
  return (
    <>
      <Video src={src} muted headless onVideoFrame={update} />
      <Screen texture={buffer.texture} />
    </>
  );
}
function ImageScreen({ src }: { src: string }) {
  const texture = useLoader(TextureLoader, src);
  texture.colorSpace = SRGBColorSpace;
  return <Screen texture={texture} />;
}
function DemoScreen({ example, accent }: { example?: ExampleScreen; accent: string }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 1008;
    const ctx = c.getContext('2d')!;
    const rect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    };
    const label = (value: string, x: number, y: number, size: number, color: string, weight = 500) => {
      ctx.fillStyle = color;
      ctx.font = weight + ' ' + size + 'px Arial';
      ctx.fillText(value, x, y);
    };
    if (example) {
      const ink = '#18231e';
      rect(0, 0, 480, 1008, 0, '#f5f6f2');
      label('9:41', 26, 44, 19, ink, 700);
      rect(390, 29, 36, 15, 4, ink);
      rect(430, 33, 5, 7, 2, ink);
      rect(24, 75, 46, 46, 13, accent);
      label(example.brand.slice(0, 1), 39, 107, 27, ink, 800);
      label(example.brand, 84, 107, 27, ink, 800);

      rect(24, 153, 432, 239, 25, '#182920');
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(24, 153, 432, 239, 25);
      ctx.clip();
      ctx.strokeStyle = accent + '55';
      ctx.lineWidth = 2;
      for (let radius = 34; radius < 150; radius += 23) {
        ctx.beginPath();
        ctx.arc(408, 360, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = '800 35px Arial';
      ctx.fillText(example.heading, 46, 251, 386);
      rect(46, 286, 84, 6, 3, accent);

      example.rows.forEach((row, index) => {
        const y = 427 + index * 110;
        rect(24, y, 432, 88, 17, '#e6ebe4');
        rect(43, y + 22, 44, 44, 13, accent);
        label(String(index + 1), 58, y + 51, 21, ink, 700);
        ctx.fillStyle = ink;
        ctx.font = '700 23px Arial';
        ctx.fillText(row, 105, y + 53, 327);
      });
      rect(24, 842, 432, 74, 23, accent);
      ctx.font = '800 26px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = ink;
      ctx.fillText(example.action, 240, 888, 366);
      rect(164, 977, 152, 7, 4, ink);
    } else {
      rect(0, 0, 480, 1008, 0, '#f4f5ed');
      label('9:41', 27, 42, 18, '#172319', 700);
      label('▰ ▰', 408, 42, 17, '#172319');
      rect(22, 68, 37, 37, 10, '#caff63');
      label('b', 33, 96, 27, '#182b1e', 900);
      label('bizinfix', 70, 96, 30, '#182b1e', 800);
      label('Good morning, Alex', 24, 151, 30, '#172319', 800);
      label('What can we help you with?', 25, 183, 21, '#5d6e5f');
      rect(24, 207, 432, 54, 16, '#e7ebe1');
      label('⌕  Search for a service', 43, 241, 19, '#5d6e5f');
      rect(24, 286, 432, 245, 24, '#183828');
      ctx.strokeStyle = '#376048';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(432, 460, 24 + i * 20, 0, Math.PI * 2);
        ctx.stroke();
      }
      label('HOME SERVICES', 48, 325, 16, '#caff63', 700);
      label('A little help.', 48, 381, 37, '#fff', 800);
      label('A lot more time.', 48, 425, 37, '#fff', 800);
      rect(47, 451, 165, 47, 23, '#caff63');
      label('Explore services', 62, 480, 17, '#19321f', 700);
      label('Popular services', 24, 587, 28, '#172319', 800);
      [
        ['⌁', 'Plumbing'],
        ['ϟ', 'Electrical'],
        ['✧', 'Cleaning'],
        ['⌂', 'Handyman'],
      ].forEach(([icon, name], i) => {
        const x = 24 + (i % 2) * 220,
          y = 609 + Math.floor(i / 2) * 121;
        rect(x, y, 208, 108, 15, '#e6ebdf');
        label(icon, x + 17, y + 44, 33, '#365846', 800);
        label(name, x + 17, y + 80, 21, '#172319', 700);
      });
      rect(0, 923, 480, 85, 0, '#e9ede2');
      label('Home          Explore          Bookings', 38, 966, 20, '#365846', 700);
      rect(165, 986, 150, 7, 4, '#1c2820');
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [example, accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <Screen texture={texture} />;
}

function Device({
  scene,
  asset,
  src,
  accent,
  mockup,
}: {
  scene: Scene;
  asset?: Asset;
  src?: string;
  accent: string;
  mockup?: MockupStyle;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = frame / Math.max(1, Math.round(scene.seconds * fps) - 1);
  const intro = interpolate(progress, [0, 0.22, 1], [0, 1, 1]);
  const eased = 1 - Math.pow(1 - intro, 3);
  const sway = Math.sin(progress * Math.PI * 2);
  const move = mockup ? (scene.camera ?? presetMove(cameraPresets[0])) : undefined;
  const t = move?.easing === 'smooth' ? progress * progress * (3 - 2 * progress) : progress;
  const value = (axis: keyof CameraPose) =>
    move ? interpolate(t, [0, 1], [move.start[axis], move.end[axis]]) : 0;
  const deg = Math.PI / 180;
  const android = mockup?.device === 'android';
  const finish = { graphite: '#222b25', silver: '#9fa9ad', green: '#355f4e' };
  const lastFrame = asset?.duration ? Math.max(0, Math.ceil(asset.duration * fps) - 1) : frame;
  return (
    <group
      position={
        move
          ? [value('x') * 0.036, value('y') * 0.036, 0]
          : [
              scene.motion === 'slide' ? (1 - eased) * 1.35 : 0,
              scene.motion === 'still' ? 0 : (1 - eased) * -0.24,
              0,
            ]
      }
      rotation={
        move
          ? [value('pitch') * deg, value('yaw') * deg, value('roll') * deg]
          : [
              0.09 + (scene.motion === 'orbit' ? sway * 0.08 : 0),
              -0.29 + (scene.motion === 'orbit' ? sway * 0.35 : 0),
              -0.16 + (scene.motion === 'orbit' ? sway * 0.09 : 0),
            ]
      }
      scale={move ? value('zoom') / 100 : scene.motion === 'zoom' ? 0.77 + 0.23 * eased : 1}
    >
      <mesh geometry={android ? androidShell : shell}>
        <meshPhysicalMaterial
          color={mockup ? finish[mockup.finish] : finish.graphite}
          metalness={0.62}
          roughness={0.24}
          clearcoat={0.7}
        />
      </mesh>
      {mockup && (
        <group position={[android ? 0.59 : 0.57, 1.56, -0.04]} rotation={[0, Math.PI, 0]}>
          <mesh geometry={rearPlate} scale={android ? [0.63, 1.14, 1] : [1, 1, 1]}>
            <meshStandardMaterial color={finish[mockup.finish]} metalness={0.48} roughness={0.31} />
          </mesh>
          {rearLenses.map(([x, y], i) => (
            <group key={i} position={android ? [0, 0.27 - i * 0.27, 0.05] : [x, y, 0.05]}>
              <mesh geometry={rearRim} scale={android ? [0.76, 0.76, 1] : [1, 1, 1]}>
                <meshStandardMaterial color="#131917" metalness={0.55} roughness={0.27} />
              </mesh>
              <mesh
                geometry={rearGlass}
                position={[0, 0, 0.005]}
                scale={android ? [0.76, 0.76, 1] : [1, 1, 1]}
              >
                <meshPhysicalMaterial color="#182b36" metalness={0.46} roughness={0.15} clearcoat={1} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      <mesh geometry={button} position={[1.078, 0.57, 0.035]}>
        <meshStandardMaterial color="#7b8a80" metalness={0.5} roughness={0.3} />
      </mesh>
      {src && asset?.kind === 'video' ? (
        <Freeze active={frame > lastFrame} frame={lastFrame}>
          <VideoScreen src={src} />
        </Freeze>
      ) : src ? (
        <ImageScreen src={src} />
      ) : (
        <DemoScreen example={scene.example} accent={accent} />
      )}
      {!android && (
        <mesh geometry={island} position={[0, 1.935, 0.165]}>
          <meshBasicMaterial color="#101412" />
        </mesh>
      )}
      <mesh position={[android ? 0 : 0.157, 1.935, 0.17]}>
        <circleGeometry args={[android ? 0.06 : 0.035, 20]} />
        <meshBasicMaterial color={android ? '#101412' : new Color(accent).multiplyScalar(0.14)} />
      </mesh>
    </group>
  );
}

export function Phone({
  width,
  height,
  ...device
}: {
  width: number;
  height: number;
  scene: Scene;
  asset?: Asset;
  src?: string;
  accent: string;
  mockup?: MockupStyle;
}) {
  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ position: [0, 0, 9.35], fov: 33 }}
      gl={{ alpha: true, antialias: true }}
      frameloop="demand"
      dpr={1}
    >
      <ambientLight
        intensity={device.mockup?.light === 'soft' ? 2.45 : device.mockup?.light === 'rim' ? 0.65 : 1.43}
      />
      <directionalLight
        color="#ffffff"
        position={[3, 5, 5]}
        intensity={device.mockup?.light === 'soft' ? 1.25 : 3.5}
      />
      <directionalLight
        color="#bcffd0"
        position={[-4, 1, 1]}
        intensity={device.mockup?.light === 'rim' ? 5.5 : 2.5}
      />
      <Device key={device.src} {...device} />
    </ThreeCanvas>
  );
}
