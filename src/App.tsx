import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraViewId,
  HiAceSceneState,
  HoveredPartInfo,
  InteractivePartId,
  RenderStyle,
} from './types/hiace';
import { HiAceViewportEngine } from './scene/HiAceViewportEngine';
import { ViewportOverlays } from './components/ViewportOverlays';
import { ControlDock } from './components/ControlDock';

const INITIAL_STATE: HiAceSceneState = {
  layoutMode: 'quad',
  activeSingleView: 'right',
  paintId: 'solid-white',
  trimSpec: 'cargo-dx',
  renderStyle: 'pbr',
  studioEnv: 'daylight',
  slidingDoorOpen: false,
  tailgateOpen: false,
  wheelSteerAngled: false,
  lightsOn: false,
  autoSpin: false,
  showDimensions: false,
};

const RENDER_CYCLE: RenderStyle[] = ['pbr', 'clay', 'wireframe'];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HiAceViewportEngine | null>(null);

  const [sceneState, setSceneState] = useState<HiAceSceneState>(INITIAL_STATE);
  const [azimuthDeg, setAzimuthDeg] = useState(43);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hoveredPart, setHoveredPart] = useState<HoveredPartInfo | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const handlePartClick = useCallback((part: InteractivePartId) => {
    setSceneState((prev) => {
      if (part === 'slidingDoor') {
        return { ...prev, slidingDoorOpen: !prev.slidingDoorOpen };
      }
      if (part === 'tailgate') {
        return { ...prev, tailgateOpen: !prev.tailgateOpen };
      }
      return { ...prev, lightsOn: !prev.lightsOn };
    });
  }, []);

  const handlePartClickRef = useRef(handlePartClick);
  handlePartClickRef.current = handlePartClick;

  // Mount Three.js engine exactly once inside isolated DOM ref container
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    let engine: HiAceViewportEngine | null = null;
    try {
      engine = new HiAceViewportEngine(mountEl, INITIAL_STATE, {
        onPartClick: (part) => handlePartClickRef.current(part),
        onPartHover: (info) => setHoveredPart(info),
        onAzimuthChange: (deg) => setAzimuthDeg(deg),
        onContextLost: (lost) => {
          setContextError(
            lost
              ? 'WebGL graphics context was interrupted. Restore to resume 3D rendering.'
              : null,
          );
        },
      });
      engineRef.current = engine;
    } catch {
      setContextError('WebGL2 is unavailable in this browser environment.');
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Push React state transitions to engine without ever remounting the canvas
  useEffect(() => {
    engineRef.current?.updateState(sceneState);
  }, [sceneState]);

  const handleSelectQuad = useCallback(() => {
    setSceneState((prev) => ({
      ...prev,
      layoutMode: 'quad',
      autoSpin: false,
    }));
  }, []);

  const handleSelect360 = useCallback(() => {
    setSceneState((prev) => {
      const next: HiAceSceneState = {
        ...prev,
        layoutMode: '360',
      };
      engineRef.current?.updateState(next, prev.layoutMode === '360');
      return next;
    });
  }, []);

  const handleSelectSingleView = useCallback((view: CameraViewId) => {
    setSceneState((prev) => ({
      ...prev,
      layoutMode: 'single',
      activeSingleView: view,
      autoSpin: false,
    }));
  }, []);

  const handleSelectPaint = useCallback((paintId: string) => {
    setSceneState((prev) => ({
      ...prev,
      paintId,
      renderStyle: prev.renderStyle === 'clay' ? 'pbr' : prev.renderStyle,
    }));
  }, []);

  const handleToggleTrimSpec = useCallback(() => {
    setSceneState((prev) => ({
      ...prev,
      trimSpec: prev.trimSpec === 'cargo-dx' ? 'super-gl' : 'cargo-dx',
    }));
  }, []);

  const handleToggleSlidingDoor = useCallback(() => {
    setSceneState((prev) => ({ ...prev, slidingDoorOpen: !prev.slidingDoorOpen }));
  }, []);

  const handleToggleTailgate = useCallback(() => {
    setSceneState((prev) => ({ ...prev, tailgateOpen: !prev.tailgateOpen }));
  }, []);

  const handleToggleWheelSteer = useCallback(() => {
    setSceneState((prev) => ({ ...prev, wheelSteerAngled: !prev.wheelSteerAngled }));
  }, []);

  const handleToggleLights = useCallback(() => {
    setSceneState((prev) => ({ ...prev, lightsOn: !prev.lightsOn }));
  }, []);

  const handleToggleDimensions = useCallback(() => {
    setSceneState((prev) => ({ ...prev, showDimensions: !prev.showDimensions }));
  }, []);

  const handleCycleRenderStyle = useCallback(() => {
    setSceneState((prev) => {
      const idx = RENDER_CYCLE.indexOf(prev.renderStyle);
      const nextStyle = RENDER_CYCLE[(idx + 1) % RENDER_CYCLE.length];
      return { ...prev, renderStyle: nextStyle };
    });
  }, []);

  const handleToggleStudioEnv = useCallback(() => {
    setSceneState((prev) => ({
      ...prev,
      studioEnv: prev.studioEnv === 'obsidian' ? 'daylight' : 'obsidian',
    }));
  }, []);

  const handleToggleAutoSpin = useCallback(() => {
    const engine = engineRef.current;
    setSceneState((prev) => {
      // Clicking Spin 360° while in 4-View smoothly enters 360° Showcase View and begins rotation
      if (prev.layoutMode !== '360') {
        return { ...prev, layoutMode: '360', autoSpin: true };
      }
      // On software WebGL where continuous auto-rotation is paused, advance cleanly by 45° per click
      if (engine?.isSoftwareGl) {
        engine.stepOrbit360(45);
        return prev;
      }
      return { ...prev, autoSpin: !prev.autoSpin };
    });
  }, []);

  const handleReset = useCallback(() => {
    setSceneState((prev) => ({
      ...prev,
      slidingDoorOpen: false,
      tailgateOpen: false,
      wheelSteerAngled: false,
      autoSpin: false,
      showDimensions: false,
    }));
    engineRef.current?.resetAllCameras();
  }, []);

  // Keyboard shortcuts for CAD-grade speed
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleAutoSpin();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'q':
          handleSelectQuad();
          break;
        case '0':
          handleSelect360();
          break;
        case '1':
          handleSelectSingleView('right');
          break;
        case '2':
          handleSelectSingleView('left');
          break;
        case '3':
          handleSelectSingleView('front');
          break;
        case '4':
          handleSelectSingleView('rear');
          break;
        case '5':
          handleSelectSingleView('top');
          break;
        case 'm':
          handleToggleTrimSpec();
          break;
        case 'd':
          handleToggleSlidingDoor();
          break;
        case 't':
          handleToggleTailgate();
          break;
        case 's':
          handleToggleWheelSteer();
          break;
        case 'l':
          handleToggleLights();
          break;
        case 'h':
          setDockCollapsed((c) => !c);
          break;
        case 'r':
          handleReset();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleSelectQuad,
    handleSelect360,
    handleSelectSingleView,
    handleToggleTrimSpec,
    handleToggleSlidingDoor,
    handleToggleTailgate,
    handleToggleWheelSteer,
    handleToggleLights,
    handleToggleAutoSpin,
    handleReset,
  ]);

  const bgFallback =
    sceneState.studioEnv === 'daylight' ? 'bg-[#f4f6f9]' : 'bg-[#0e1218]';

  return (
    <main className={`relative w-screen h-screen overflow-hidden ${bgFallback}`}>
      {/* Isolated WebGL Canvas Container (never re-rendered by React state) */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Interactive 3D Four-View and 360-Degree Toyota HiAce H200 PANELCO III Studio Viewport"
      />

      {/* Graceful WebGL Context Loss / Fallback Panel */}
      {contextError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#11151b]/95 p-6">
          <div className="max-w-md rounded-xl border border-white/12 bg-[#161b24] p-6 text-center">
            <h2 className="text-base font-semibold text-white">
              3D Viewport Unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-400">{contextError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors cursor-pointer"
            >
              Reload Studio
            </button>
          </div>
        </div>
      )}

      {/* Semantic Architectural Viewport Overlays & Quad-View / 360° Chrome */}
      <ViewportOverlays
        state={sceneState}
        azimuthDeg={azimuthDeg}
        hoveredPart={hoveredPart}
        dockCollapsed={dockCollapsed}
        onFocusSingleView={handleSelectSingleView}
        onSelect360={handleSelect360}
        onReturnToQuad={handleSelectQuad}
      />

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <ControlDock
        state={sceneState}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        onSelectQuad={handleSelectQuad}
        onSelect360={handleSelect360}
        onSelectSingleView={handleSelectSingleView}
        onSelectPaint={handleSelectPaint}
        onToggleTrimSpec={handleToggleTrimSpec}
        onToggleSlidingDoor={handleToggleSlidingDoor}
        onToggleTailgate={handleToggleTailgate}
        onToggleWheelSteer={handleToggleWheelSteer}
        onToggleLights={handleToggleLights}
        onToggleDimensions={handleToggleDimensions}
        onCycleRenderStyle={handleCycleRenderStyle}
        onToggleStudioEnv={handleToggleStudioEnv}
        onToggleAutoSpin={handleToggleAutoSpin}
        onReset={handleReset}
      />
    </main>
  );
}
