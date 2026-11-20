import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
} from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  Maximize,
  Music2,
  PanelTop,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  assetUrl,
  createProject,
  formats,
  frames,
  newScene,
  templates,
  type Asset,
  type Format,
  type Project,
  type Scene,
} from './model';
import { Demo } from './video/Demo';

type Job = {
  id: string;
  status: 'queued' | 'rendering' | 'done' | 'error';
  format: 'mp4' | 'png';
  progress: number;
  error?: string;
};
type View = 'studio' | 'projects' | 'templates';
const storage = 'bizinfix-studio-v1';
function initialProjects(): Project[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storage) ?? 'null');
    if (Array.isArray(saved)) return saved;
  } catch {
    /* Recover from unreadable browser storage. */
  }
  return [createProject()];
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(data?.error || 'La requête locale a échoué (' + response.status + ').');
  return data as T;
}
function getDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const src = URL.createObjectURL(file);
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      const duration = video.duration;
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(src);
      if (error || !Number.isFinite(duration) || duration <= 0)
        reject(error ?? new Error('Durée vidéo indisponible.'));
      else resolve(duration);
    };
    const timeout = setTimeout(() => finish(new Error('Lecture du fichier vidéo impossible.')), 12000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(new Error('Ce navigateur ne peut pas lire ce fichier vidéo.'));
    video.src = src;
  });
}
const timecode = (frame: number, fps: number) => {
  const total = Math.floor(frame / fps);
  return [Math.floor(total / 60), total % 60, frame % fps]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
};

export function App() {
  const [projects, setProjects] = useState(initialProjects);
  const [active, setActive] = useState(() => projects[0]?.id ?? '');
  const [view, setView] = useState<View>(projects.length ? 'studio' : 'projects');
  const [sceneId, setSceneId] = useState('');
  const [tab, setTab] = useState<'scene' | 'brand' | 'audio'>('scene');
  const [mediaFilter, setMediaFilter] = useState<'all' | Asset['kind']>('all');
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [job, setJob] = useState<Job>();
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(true);
  const [uploading, setUploading] = useState(false);
  const player = useRef<PlayerRef>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const project = projects.find((p) => p.id === active);
  const scene = project?.scenes.find((s) => s.id === sceneId) ?? project?.scenes[0];
  const total = project ? frames(project) : 1;
  const [width, height] = formats[project?.format ?? '16:9'];
  const fps = project?.fps ?? 30;

  useEffect(() => {
    try {
      localStorage.setItem(storage, JSON.stringify(projects));
      setSaved(true);
    } catch {
      setSaved(false);
      setNotice('La sauvegarde locale a échoué. Vérifiez l’espace disponible.');
    }
  }, [projects]);
  useEffect(() => {
    const current = player.current;
    if (!current || view !== 'studio') return;
    setFrame(current.getCurrentFrame());
    const update = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    current.addEventListener('frameupdate', update);
    current.addEventListener('play', play);
    current.addEventListener('pause', pause);
    current.addEventListener('ended', pause);
    return () => {
      current.removeEventListener('frameupdate', update);
      current.removeEventListener('play', play);
      current.removeEventListener('pause', pause);
      current.removeEventListener('ended', pause);
    };
  }, [active, view]);
  const running = job?.status === 'queued' || job?.status === 'rendering';
  const jobId = job?.id;
  useEffect(() => {
    if (!running || !jobId) return;
    const controller = new AbortController();
    let failures = 0;
    let timer: number;
    const poll = async () => {
      try {
        const next = await api<Job>('/api/renders/' + jobId, { signal: controller.signal });
        if (controller.signal.aborted) return;
        failures = 0;
        setJob(next);
        if (next.status === 'done' || next.status === 'error') return;
      } catch (error) {
        if (controller.signal.aborted) return;
        failures++;
        if (failures >= 3) {
          setJob((previous) =>
            previous ? { ...previous, status: 'error', error: (error as Error).message } : previous,
          );
          return;
        }
      }
      timer = window.setTimeout(poll, failures ? 1500 : 750);
    };
    timer = window.setTimeout(poll, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [jobId, running]);

  function patch(changes: Partial<Project>) {
    setProjects((previous) => previous.map((p) => (p.id === active ? { ...p, ...changes } : p)));
  }
  function patchScene(changes: Partial<Scene>) {
    setProjects((previous) =>
      previous.map((p) =>
        p.id === active
          ? { ...p, scenes: p.scenes.map((s) => (s.id === scene?.id ? { ...s, ...changes } : s)) }
          : p,
      ),
    );
  }
  function open(p: Project) {
    setActive(p.id);
    setSceneId(p.scenes[0].id);
    setFrame(0);
    setPlaying(false);
    setMuted(false);
    setTab('scene');
    setMediaFilter('all');
    setView('studio');
  }
  function newProject(template?: (typeof templates)[number]) {
    const p = createProject(template?.name ?? 'Projet sans titre');
    if (template) {
      p.accent = template.accent;
      p.background = template.background;
      p.scenes = [{ ...newScene(), title: template.title, subtitle: template.subtitle }];
    }
    setProjects((all) => [p, ...all]);
    open(p);
  }
  function duplicate(p: Project) {
    const copy = {
      ...p,
      id: crypto.randomUUID(),
      name: (p.name + ' (copie)').slice(0, 150),
      scenes: p.scenes.map((s) => ({ ...s, id: crypto.randomUUID() })),
    };
    setProjects((all) => [copy, ...all]);
    open(copy);
  }
  function remove(p: Project) {
    if (!window.confirm('Supprimer « ' + p.name + ' » ?')) return;
    setProjects((all) => all.filter((item) => item.id !== p.id));
    if (active === p.id) {
      setActive('');
      setView('projects');
    }
  }
  function seek(value: number) {
    const next = Math.min(total - 1, Math.max(0, Math.round(value)));
    player.current?.seekTo(next);
    setFrame(next);
  }
  function selectScene(s: Scene) {
    if (!project) return;
    const index = project.scenes.findIndex((item) => item.id === s.id);
    setSceneId(s.id);
    setTab('scene');
    seek(project.scenes.slice(0, index).reduce((sum, item) => sum + Math.round(item.seconds * fps), 0));
  }
  function addScene() {
    if (!project || project.scenes.length >= 100) return;
    const item = newScene();
    patch({ scenes: [...project.scenes, item] });
    setSceneId(item.id);
    setTab('scene');
  }
  function moveScene(delta: number) {
    if (!project || !scene) return;
    const index = project.scenes.indexOf(scene);
    const target = index + delta;
    if (target < 0 || target >= project.scenes.length) return;
    const scenes = [...project.scenes];
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
    patch({ scenes });
    seek(scenes.slice(0, target).reduce((sum, item) => sum + Math.round(item.seconds * fps), 0));
  }
  async function importFiles(files: FileList | null) {
    if (!files || !project || uploading) return;
    const id = project.id;
    const selected = scene?.id;
    setUploading(true);
    setNotice('');
    try {
      for (const file of Array.from(files).slice(0, 500 - project.assets.length)) {
        const duration = /\.(mp4|webm)$/i.test(file.name) ? await getDuration(file) : undefined;
        const body = new FormData();
        body.append('file', file);
        const asset = { ...(await api<Asset>('/api/media', { method: 'POST', body })), duration };
        setProjects((list) =>
          list.map((p) => {
            if (p.id !== id) return p;
            return {
              ...p,
              assets: [...p.assets, asset],
              scenes: p.scenes.map((s) =>
                s.id === selected && asset.kind !== 'audio' && !s.asset ? { ...s, asset: asset.id } : s,
              ),
            };
          }),
        );
      }
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function startExport(format: Job['format']) {
    if (!project || running) return;
    setNotice('');
    setExportOpen(false);
    setJob({ id: '', status: 'queued', progress: 0, format });
    try {
      setJob(
        await api<Job>('/api/renders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project, format }),
        }),
      );
    } catch (error) {
      setJob(undefined);
      setNotice((error as Error).message);
    }
  }

  const onImport = (e: ChangeEvent<HTMLInputElement>) => {
    void importFiles(e.currentTarget.files);
    e.currentTarget.value = '';
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    void importFiles(e.dataTransfer.files);
  };
  const studio = view === 'studio' && project && scene;
  const assets = project?.assets.filter((a) => mediaFilter === 'all' || a.kind === mediaFilter) ?? [];
  const visualAssets = project?.assets.filter((a) => a.kind !== 'audio') ?? [];
  const audioAssets = project?.assets.filter((a) => a.kind === 'audio') ?? [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => setView('projects')}>
          <span className="brand">
            <Clapperboard size={19} />
          </span>
          <span>
            Bizinfix <b>Studio</b>
          </span>
        </button>
        <div className="topnav">
          <button
            className={view === 'projects' ? 'nav-active' : ''}
            onClick={() => setView('projects')}
          >
            <FolderOpen size={15} />
            Projets
          </button>
          <button
            className={view === 'templates' ? 'nav-active' : ''}
            onClick={() => setView('templates')}
          >
            <Layers3 size={15} />
            Modèles
          </button>
          {project && (
            <button
              className={view === 'studio' ? 'nav-active' : ''}
              onClick={() => {
                if (view !== 'studio') open(project);
              }}
            >
              <PanelTop size={15} />
              Éditeur
            </button>
          )}
        </div>
        <div className="top-actions">
          {studio && (
            <>
              <span className="saved">
                <Check size={14} />
                {saved ? 'Sauvegardé' : 'Sauvegarde indisponible'}
              </span>
              <div className="export-wrap">
                <button className="primary" disabled={running} onClick={() => setExportOpen((v) => !v)}>
                  <ArrowDownToLine size={16} /> Exporter <ChevronDown size={13} />
                </button>
                {exportOpen && (
                  <div className="export-menu">
                    <button onClick={() => void startExport('mp4')}>
                      <Film size={16} /> Vidéo MP4
                    </button>
                    <button onClick={() => void startExport('png')}>
                      <ImageIcon size={16} /> Miniature PNG
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {!studio && (
            <button className="primary" onClick={() => newProject()}>
              <Plus size={17} /> Nouveau projet
            </button>
          )}
        </div>
      </header>
      {(notice || job) && (
        <div className="notification" role="status">
          {notice && <span>{notice}</span>}
          {job &&
            (job.status === 'done' ? (
              <a href={'/api/renders/' + job.id + '/download'}>
                <ArrowDownToLine size={16} /> Télécharger le {job.format.toUpperCase()}
              </a>
            ) : job.status === 'error' ? (
              <span>Échec du rendu. {job.error}</span>
            ) : (
              <>
                <span>
                  {job.status === 'queued' ? 'Rendu en attente' : 'Rendu ' + job.format.toUpperCase()} ·{' '}
                  {Math.round(job.progress * 100)} %
                </span>
                <progress value={job.progress} max={1} />
              </>
            ))}
          {!running && (
            <button
              onClick={() => {
                setNotice('');
                setJob(undefined);
              }}
            >
              Fermer
            </button>
          )}
        </div>
      )}
      {studio && project && scene ? (
        <main className="workspace">
          <aside className="media panel" onDragOver={(e) => e.preventDefault()} onDrop={drop}>
            <div className="panel-heading">
              <div>
                <FolderOpen size={16} />
                <h2>Médias</h2>
              </div>
              <button
                className="icon framed"
                title="Importer des médias"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Plus size={16} />
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept=".mp4,.webm,.png,.jpeg,.jpg,.webp,.mp3,.wav,.m4a,.ogg"
              onChange={onImport}
            />
            <div className="filters">
              {(
                [
                  ['all', 'Tout'],
                  ['video', 'Vidéos'],
                  ['image', 'Images'],
                  ['audio', 'Audio'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={mediaFilter === key ? 'chosen' : ''}
                  onClick={() => setMediaFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {mediaFilter === 'all' && (
              <button
                className={'media-card ' + (!scene.asset ? 'active-media' : '')}
                onClick={() => patchScene({ asset: undefined })}
              >
                <div className="demo-thumb">
                  <span className="mini-phone">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="asset-tag">DÉMO</span>
                </div>
                <span className="file-label">
                  <Film size={13} /> Écran Bizinfix
                </span>
              </button>
            )}
            <div className="asset-list">
              {assets.map((a) => (
                <button
                  key={a.id}
                  className={'asset-row ' + (a.id === scene.asset ? 'chosen' : '')}
                  onClick={() => (a.kind === 'audio' ? setTab('audio') : patchScene({ asset: a.id }))}
                >
                  {a.kind === 'video' ? (
                    <Film size={15} />
                  ) : a.kind === 'image' ? (
                    <img src={assetUrl(a.id)} alt="" />
                  ) : (
                    <Music2 size={15} />
                  )}
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
            <button className="dropzone" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <UploadCloud size={21} />
              <strong>{uploading ? 'Import en cours…' : 'Importer des fichiers'}</strong>
              <small>ou glissez-les ici</small>
            </button>
          </aside>
          <section className="preview panel">
            <div className="panel-heading preview-heading">
              <div className="project-heading">
                <button className="icon" title="Retour aux projets" onClick={() => setView('projects')}>
                  <ArrowLeft size={16} />
                </button>
                <span className="divider" />
                <input
                  aria-label="Nom du projet"
                  className="project-name"
                  value={project.name}
                  maxLength={150}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
              <div className="preview-settings">
                <select
                  aria-label="Format vidéo"
                  value={project.format}
                  onChange={(e) => patch({ format: e.target.value as Format })}
                >
                  {Object.keys(formats).map((key) => (
                    <option key={key}>{key}</option>
                  ))}
                </select>
                <button
                  className="icon framed"
                  title="Plein écran"
                  onClick={() => player.current?.requestFullscreen()}
                >
                  <Maximize size={15} />
                </button>
              </div>
            </div>
            <div className="stage">
              <div className="preview-fit" style={{ '--video-ratio': width / height } as CSSProperties}>
                <Player
                  key={project.id}
                  ref={player}
                  component={Demo}
                  inputProps={{ project }}
                  durationInFrames={Math.max(1, total)}
                  compositionWidth={width}
                  compositionHeight={height}
                  fps={fps}
                  initialFrame={Math.min(total - 1, Math.round(fps * 0.48))}
                  style={{ width: '100%', height: '100%' }}
                  acknowledgeRemotionLicense
                  errorFallback={({ error }) => <div className="player-error">{error.message}</div>}
                />
              </div>
            </div>
            <div className="transport">
              <span className="timecode">
                <b>{timecode(frame, fps)}</b> <span>/ {timecode(total, fps)}</span>
              </span>
              <div className="playback">
                <button className="icon" title="Début" onClick={() => seek(0)}>
                  <SkipBack size={17} />
                </button>
                <button
                  className="play"
                  title={playing ? 'Pause' : 'Lire'}
                  onClick={() => player.current?.toggle()}
                >
                  {playing ? (
                    <Pause size={17} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                </button>
                <button className="icon" title="Fin" onClick={() => seek(total - 1)}>
                  <SkipForward size={17} />
                </button>
              </div>
              <button
                className="icon sound"
                title={muted ? 'Activer le son' : 'Couper le son'}
                onClick={() => {
                  if (muted) player.current?.unmute();
                  else player.current?.mute();
                  setMuted(!muted);
                }}
              >
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
            </div>
          </section>
          <aside className="inspector panel">
            <div className="panel-heading">
              <div>
                <PanelTop size={16} />
                <h2>Personnalisation</h2>
              </div>
            </div>
            <div className="inspector-tabs">
              {(
                [
                  ['scene', 'Scène'],
                  ['brand', 'Identité'],
                  ['audio', 'Audio'],
                ] as const
              ).map(([key, label]) => (
                <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="inspector-body">
              {tab === 'scene' && (
                <>
                  <h3>Contenu</h3>
                  <label>
                    Titre
                    <textarea
                      aria-label="Titre"
                      value={scene.title}
                      maxLength={250}
                      rows={2}
                      onChange={(e) => patchScene({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    Sous-titre
                    <textarea
                      aria-label="Sous-titre"
                      value={scene.subtitle}
                      maxLength={500}
                      rows={2}
                      onChange={(e) => patchScene({ subtitle: e.target.value })}
                    />
                  </label>
                  <label>
                    Écran du smartphone
                    <select
                      value={scene.asset ?? ''}
                      onChange={(e) => patchScene({ asset: e.target.value || undefined })}
                    >
                      <option value="">Écran Bizinfix</option>
                      {visualAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-section">
                    <h3>Animation</h3>
                    <div className="field-pair">
                      <label>
                        Mouvement
                        <select
                          value={scene.motion}
                          onChange={(e) => patchScene({ motion: e.target.value as Scene['motion'] })}
                        >
                          <option value="orbit">Rotation</option>
                          <option value="zoom">Zoom</option>
                          <option value="slide">Glissement</option>
                          <option value="still">Fixe</option>
                        </select>
                      </label>
                      <label>
                        Durée (s)
                        <input
                          aria-label="Durée (s)"
                          type="number"
                          min={1}
                          max={60}
                          step={0.1}
                          key={scene.id}
                          defaultValue={scene.seconds}
                          onBlur={(e) => {
                            const seconds = Math.min(60, Math.max(1, Number(e.target.value) || 1));
                            e.target.value = String(seconds);
                            patchScene({ seconds });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}
              {tab === 'brand' && (
                <>
                  <h3>Identité visuelle</h3>
                  <label>
                    Arrière-plan
                    <div className="color-field">
                      <input
                        type="color"
                        value={project.background}
                        onChange={(e) => patch({ background: e.target.value })}
                      />
                      <span>{project.background.toUpperCase()}</span>
                    </div>
                  </label>
                  <label>
                    Couleur d’accent
                    <div className="color-field">
                      <input
                        type="color"
                        value={project.accent}
                        onChange={(e) => patch({ accent: e.target.value })}
                      />
                      <span>{project.accent.toUpperCase()}</span>
                    </div>
                  </label>
                  <label>
                    Typographie
                    <select value={project.font} onChange={(e) => patch({ font: e.target.value })}>
                      {['Arial', 'Georgia', 'Trebuchet MS', 'Verdana'].map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Logo
                    <select
                      value={project.logo ?? ''}
                      onChange={(e) => patch({ logo: e.target.value || undefined })}
                    >
                      <option value="">Logo Bizinfix</option>
                      {visualAssets
                        .filter((a) => a.kind === 'image')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Images par seconde
                    <select
                      value={fps}
                      onChange={(e) => patch({ fps: Number(e.target.value) as 30 | 60 })}
                    >
                      <option value={30}>30 FPS</option>
                      <option value={60}>60 FPS</option>
                    </select>
                  </label>
                </>
              )}
              {tab === 'audio' && (
                <>
                  <h3>Pistes audio</h3>
                  <label>
                    Musique
                    <select
                      value={project.music ?? ''}
                      onChange={(e) => patch({ music: e.target.value || undefined })}
                    >
                      <option value="">Aucune</option>
                      {audioAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Voix off
                    <select
                      value={project.voice ?? ''}
                      onChange={(e) => patch({ voice: e.target.value || undefined })}
                    >
                      <option value="">Aucune</option>
                      {audioAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                  >
                    <ArrowUpFromLine size={15} /> Importer un audio
                  </button>
                </>
              )}
            </div>
          </aside>
          <section className="timeline panel">
            <div className="panel-heading">
              <div>
                <Layers3 size={16} />
                <h2>Timeline</h2>
                <span className="timeline-count">
                  {project.scenes.length} scène{project.scenes.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="timeline-actions">
                <button
                  className="icon"
                  title="Déplacer la scène à gauche"
                  disabled={project.scenes.indexOf(scene) === 0}
                  onClick={() => moveScene(-1)}
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  className="icon"
                  title="Déplacer la scène à droite"
                  disabled={project.scenes.indexOf(scene) === project.scenes.length - 1}
                  onClick={() => moveScene(1)}
                >
                  <ArrowRight size={15} />
                </button>
                <button
                  className="icon"
                  title="Supprimer la scène"
                  disabled={project.scenes.length < 2}
                  onClick={() => {
                    patch({ scenes: project.scenes.filter((s) => s.id !== scene.id) });
                    setSceneId('');
                    seek(0);
                  }}
                >
                  <Trash2 size={15} />
                </button>
                <button className="secondary" disabled={project.scenes.length >= 100} onClick={addScene}>
                  <Plus size={15} /> Ajouter une scène
                </button>
              </div>
            </div>
            <div className="timeline-body">
              <div className="track-label">
                <Film size={15} /> Scènes
              </div>
              <div className="track-area">
                <div className="ruler">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i}>
                      {((i * total) / fps / 6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s
                    </span>
                  ))}
                </div>
                <input
                  className="scrubber"
                  type="range"
                  min={0}
                  max={total - 1}
                  value={Math.min(frame, total - 1)}
                  aria-label="Position de lecture"
                  onChange={(e) => seek(Number(e.target.value))}
                />
                <div className="clips">
                  {project.scenes.map((s, index) => (
                    <button
                      style={{ flexGrow: s.seconds }}
                      className={'clip ' + (scene.id === s.id ? 'active-clip' : '')}
                      key={s.id}
                      onClick={() => selectScene(s)}
                    >
                      <span className="clip-icon">
                        <Film size={15} />
                      </span>
                      <span>
                        <strong>{s.title.replaceAll('\n', ' ') || 'Scène ' + (index + 1)}</strong>
                        <small>{s.seconds} s</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  className="playhead"
                  style={{ left: Math.min(100, (100 * frame) / Math.max(1, total - 1)) + '%' }}
                />
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="collection">
          <h1>{view === 'templates' ? 'Modèles' : 'Projets vidéo'}</h1>
          {view === 'templates' ? (
            <div className="card-grid">
              {templates.map((t) => (
                <button key={t.name} className="project-card" onClick={() => newProject(t)}>
                  <div className="project-poster" style={{ background: t.background, color: t.accent }}>
                    <Clapperboard size={24} />
                    <strong>{t.title}</strong>
                  </div>
                  <span>
                    {t.name}
                    <ArrowRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="card-grid">
              {projects.map((p) => (
                <article className="project-card" key={p.id}>
                  <button
                    className="project-poster"
                    style={{ background: p.background, color: p.accent }}
                    onClick={() => open(p)}
                  >
                    <Clapperboard size={24} />
                    <strong>{p.scenes[0].title}</strong>
                  </button>
                  <div className="project-card-footer">
                    <button onClick={() => open(p)}>{p.name || 'Projet sans titre'}</button>
                    <button className="icon" title="Dupliquer" onClick={() => duplicate(p)}>
                      <Copy size={16} />
                    </button>
                    <button className="icon" title="Supprimer" onClick={() => remove(p)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
              {!projects.length && (
                <button className="secondary" onClick={() => newProject()}>
                  <Plus size={17} /> Créer un projet
                </button>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
