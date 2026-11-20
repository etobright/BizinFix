import { Composition, registerRoot } from 'remotion';
import { Demo } from './Demo';
import { formats, frames, type Project } from '../model';
const placeholder: Project = {
  id: '',
  name: 'Bizinfix',
  format: '16:9',
  fps: 30,
  background: '#101d18',
  accent: '#caff63',
  font: 'Arial',
  scenes: [],
  assets: [],
};
function Root() {
  return (
    <Composition
      id="BizinfixDemo"
      component={Demo}
      durationInFrames={180}
      fps={30}
      height={1080}
      width={1920}
      defaultProps={{ project: placeholder, origin: '' }}
      calculateMetadata={({ props }) => {
        const [width, height] = formats[props.project.format];
        return {
          width,
          height,
          fps: props.project.fps,
          durationInFrames: Math.max(1, frames(props.project)),
        };
      }}
    />
  );
}
registerRoot(Root);
