import { Box, RotateCcw } from 'lucide-react';
import { cameraPresets, presetMove, type CameraMove, type CameraPose, type MockupStyle } from './model';

const controls: { key: keyof CameraPose; label: string; low: number; high: number; unit: string }[] = [
  { key: 'yaw', label: 'Rotation', low: -180, high: 180, unit: '°' },
  { key: 'pitch', label: 'Inclinaison', low: -85, high: 85, unit: '°' },
  { key: 'roll', label: 'Roulis', low: -180, high: 180, unit: '°' },
  { key: 'zoom', label: 'Zoom', low: 55, high: 170, unit: '%' },
  { key: 'x', label: 'Position X', low: -100, high: 100, unit: '' },
  { key: 'y', label: 'Position Y', low: -100, high: 100, unit: '' },
];

export function CameraPanel({
  style,
  move,
  slot,
  onStyle,
  onMove,
  onPose,
  onSlot,
}: {
  style: MockupStyle;
  move: CameraMove;
  slot: 'start' | 'end';
  onStyle: (patch: Partial<MockupStyle>) => void;
  onMove: (move: CameraMove) => void;
  onPose: (patch: Partial<CameraPose>) => void;
  onSlot: (slot: 'start' | 'end') => void;
}) {
  return (
    <>
      <h3>
        <Box size={15} /> Appareil
      </h3>
      <div className="device-choices" aria-label="Type de téléphone">
        <button aria-pressed={style.device === 'iphone'} onClick={() => onStyle({ device: 'iphone' })}>
          <span className="device-outline iphone" /> iPhone
        </button>
        <button aria-pressed={style.device === 'android'} onClick={() => onStyle({ device: 'android' })}>
          <span className="device-outline android" /> Android
        </button>
      </div>
      <div className="field-pair">
        <label>
          Finition
          <select
            value={style.finish}
            onChange={(e) => onStyle({ finish: e.target.value as MockupStyle['finish'] })}
          >
            <option value="graphite">Graphite</option>
            <option value="silver">Argent</option>
            <option value="green">Vert</option>
          </select>
        </label>
        <label>
          Éclairage
          <select
            value={style.light}
            onChange={(e) => onStyle({ light: e.target.value as MockupStyle['light'] })}
          >
            <option value="studio">Studio</option>
            <option value="soft">Doux</option>
            <option value="rim">Contraste</option>
          </select>
        </label>
      </div>
      <div className="form-section">
        <div className="camera-heading">
          <h3>Caméra</h3>
          <button
            className="icon"
            title="Réinitialiser la caméra"
            onClick={() => onMove(presetMove(cameraPresets[0]))}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="camera-slots" aria-label="Image clé de caméra">
          <button aria-pressed={slot === 'start'} onClick={() => onSlot('start')}>
            Début
          </button>
          <button aria-pressed={slot === 'end'} onClick={() => onSlot('end')}>
            Fin
          </button>
        </div>
        {controls.map(({ key, label, low, high, unit }) => (
          <label className="camera-range" key={key}>
            <span>
              {label}
              <output>
                {Math.round(move[slot][key])}
                {unit}
              </output>
            </span>
            <input
              type="range"
              min={low}
              max={high}
              step={1}
              value={move[slot][key]}
              aria-label={label}
              onChange={(e) => onPose({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <div className="field-pair camera-curve">
          <label>
            Mouvement
            <select
              aria-label="Préréglage de mouvement"
              value=""
              onChange={(e) => {
                const preset = cameraPresets.find((item) => item.id === e.target.value);
                if (preset) onMove(presetMove(preset));
              }}
            >
              <option value="" disabled>
                Choisir…
              </option>
              {cameraPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Courbe
            <select
              value={move.easing}
              onChange={(e) => onMove({ ...move, easing: e.target.value as CameraMove['easing'] })}
            >
              <option value="smooth">Fluide</option>
              <option value="linear">Linéaire</option>
            </select>
          </label>
        </div>
      </div>
    </>
  );
}
