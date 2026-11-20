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
import { type Asset, type Scene } from '../model';

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
function DemoScreen() {
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
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <Screen texture={texture} />;
}

function Device({
  scene,
  asset,
  src,
  accent,
}: {
  scene: Scene;
  asset?: Asset;
  src?: string;
  accent: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = frame / Math.max(1, Math.round(scene.seconds * fps) - 1);
  const intro = interpolate(progress, [0, 0.22, 1], [0, 1, 1]);
  const eased = 1 - Math.pow(1 - intro, 3);
  const sway = Math.sin(progress * Math.PI * 2);
  const lastFrame = asset?.duration ? Math.max(0, Math.ceil(asset.duration * fps) - 1) : frame;
  return (
    <group
      position={[
        scene.motion === 'slide' ? (1 - eased) * 1.35 : 0,
        scene.motion === 'still' ? 0 : (1 - eased) * -0.24,
        0,
      ]}
      rotation={[
        0.09 + (scene.motion === 'orbit' ? sway * 0.08 : 0),
        -0.29 + (scene.motion === 'orbit' ? sway * 0.35 : 0),
        -0.16 + (scene.motion === 'orbit' ? sway * 0.09 : 0),
      ]}
      scale={scene.motion === 'zoom' ? 0.77 + 0.23 * eased : 1}
    >
      <mesh geometry={shell}>
        <meshPhysicalMaterial color="#222b25" metalness={0.62} roughness={0.24} clearcoat={0.7} />
      </mesh>
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
        <DemoScreen />
      )}
      <mesh geometry={island} position={[0, 1.935, 0.165]}>
        <meshBasicMaterial color="#101412" />
      </mesh>
      <mesh position={[0.157, 1.935, 0.17]}>
        <circleGeometry args={[0.035, 20]} />
        <meshBasicMaterial color={new Color(accent).multiplyScalar(0.14)} />
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
      <ambientLight intensity={1.43} />
      <directionalLight color="#ffffff" position={[3, 5, 5]} intensity={3.5} />
      <directionalLight color="#bcffd0" position={[-4, 1, 1]} intensity={2.5} />
      <Device key={device.src} {...device} />
    </ThreeCanvas>
  );
}
