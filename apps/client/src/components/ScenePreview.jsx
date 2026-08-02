/* eslint-disable react/no-unknown-property -- React Three Fiber JSX props */
import { Component, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Color } from 'three';
import { moduleCenterPosition } from './modulePose.js';

const FINISH_COLORS = {
  white: '#f5f5f4',
  oak: '#c08a4f'
};

const DEFAULT_ROOM = { widthMm: 3000, depthMm: 4000, heightMm: 2700 };
const FALLBACK_FINISH = '#6d8f71';

/**
 * @typedef {{
 *   instanceId: string,
 *   sku: string,
 *   finishId?: string,
 *   rotationY: number,
 *   position: { x: number, y: number, z: number },
 *   dimensions: { widthMm: number, heightMm: number, depthMm: number }
 * }} SceneModule
 */

/** @param {{ module: SceneModule }} props */
function BoxFallbackGeometry({ module }) {
  const width = module.dimensions.widthMm / 1000;
  const height = module.dimensions.heightMm / 1000;
  const depth = module.dimensions.depthMm / 1000;
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={FINISH_COLORS[module.finishId] ?? FALLBACK_FINISH}
        roughness={0.7}
      />
    </mesh>
  );
}

/**
 * Loaded glTF: tint only material slot `facade`; leave `carcass` as authored.
 * @param {{ module: SceneModule }} props
 */
function ModuleGltfModel({ module }) {
  const url = `/gltf/${encodeURIComponent(module.sku)}.glb`;
  const { scene } = useGLTF(url);
  const finishColor = FINISH_COLORS[module.finishId];

  const root = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj) => {
      if (!('isMesh' in obj) || !obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;

      const sourceMaterials = Array.isArray(obj.material)
        ? obj.material
        : obj.material
          ? [obj.material]
          : [];
      const clonedMaterials = sourceMaterials.map((mat) => {
        const next = mat.clone();
        if (next.name === 'facade' && finishColor) {
          next.color = new Color(finishColor);
        }
        return next;
      });

      obj.material = Array.isArray(obj.material)
        ? clonedMaterials
        : (clonedMaterials[0] ?? obj.material);
    });
    return cloned;
  }, [scene, finishColor]);

  return <primitive object={root} />;
}

/**
 * Catches failed `/gltf/{sku}.glb` loads and falls back to box geometry.
 * Dialog / orchestrator are unaffected — only the mesh changes.
 */
class GltfErrorBoundary extends Component {
  /** @param {{ resetKey: string, fallback: import('react').ReactNode, children: import('react').ReactNode }} props */
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  /** @returns {{ hasError: boolean }} */
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  /**
   * @param {Error} error
   */
  componentDidCatch(error) {
    console.warn(
      '[ScenePreview] glTF load failed, using box fallback:',
      error?.message ?? error
    );
  }

  /**
   * @param {{ resetKey: string }} prevProps
   */
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/** @param {{ module: SceneModule }} props */
function ModuleBox({ module }) {
  const position = moduleCenterPosition(module);
  const rotationY = (module.rotationY * Math.PI) / 180;
  const box = <BoxFallbackGeometry module={module} />;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {module.sku ? (
        <GltfErrorBoundary resetKey={module.sku} fallback={box}>
          <Suspense fallback={box}>
            <ModuleGltfModel module={module} />
          </Suspense>
        </GltfErrorBoundary>
      ) : (
        box
      )}
    </group>
  );
}

/**
 * Draws a 3D room (floor + back wall + left wall) sized to the room shape.
 * The room corner sits at the origin so it aligns with module placement.
 *
 * @param {{ width: number, depth: number, height: number }} props
 */
function Room({ width, depth, height }) {
  const wallT = 0.08;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[width / 2, 0, depth / 2]}
        receiveShadow
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#2a3038" roughness={0.9} />
      </mesh>

      {/* Back wall — thickness grows outward (−z) so the inner face stays at z = 0 */}
      <mesh
        position={[(width - wallT) / 2, height / 2, -wallT / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width + wallT, height, wallT]} />
        <meshStandardMaterial color="#22262d" roughness={1} />
      </mesh>

      {/* Left wall — thickness grows outward (−x) so the inner face stays at x = 0 */}
      <mesh
        position={[-wallT / 2, height / 2, depth / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[wallT, height, depth]} />
        <meshStandardMaterial color="#1e2228" roughness={1} />
      </mesh>
    </group>
  );
}

/**
 * Natural room lighting without visible fixtures: warm ceiling fill points
 * plus cooler daylight from the open (+x) side, like a window.
 *
 * @param {{ width: number, depth: number, height: number }} props
 */
function RoomLighting({ width, depth, height }) {
  const y = height - 0.08;
  const reach = Math.max(width, depth) * 1.6;
  const fixtures = /** @type {[number, number][]} */ ([
    [width * 0.33, depth * 0.33],
    [width * 0.66, depth * 0.66],
    [width * 0.33, depth * 0.66],
    [width * 0.66, depth * 0.33]
  ]);

  return (
    <group>
      <hemisphereLight args={['#e8f0ff', '#2a2620', 0.65]} />
      <ambientLight intensity={0.35} />

      {/* Daylight from the open right side — no shadows (avoids blacking out the room) */}
      <directionalLight
        color="#f2f6ff"
        intensity={1.8}
        position={[width + 2.5, height * 0.9, depth * 0.5]}
      />
      <directionalLight
        color="#eef3ff"
        intensity={0.55}
        position={[width * 0.5, height * 0.75, depth + 2.2]}
      />

      {fixtures.map(([x, z], index) => (
        <pointLight
          key={index}
          position={[x, y, z]}
          color="#ffe3b8"
          intensity={6}
          distance={reach}
          decay={2}
          castShadow={index === 0}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
      ))}
    </group>
  );
}

/**
 * @param {{
 *   sceneResult: { projectId: string, modules?: any[] } | null,
 *   roomShape?: { dimensions: { widthMm: number, depthMm: number, heightMm: number } } | null
 * }} props
 */
export function ScenePreview({ sceneResult, roomShape }) {
  /** @type {SceneModule[]} */
  const modules = /** @type {SceneModule[]} */ (sceneResult?.modules ?? []);
  const dims = roomShape?.dimensions ?? DEFAULT_ROOM;
  const width = dims.widthMm / 1000;
  const depth = dims.depthMm / 1000;
  const height = dims.heightMm / 1000;

  const target = /** @type {[number, number, number]} */ ([width / 2, height / 4, depth / 2]);
  const camera = {
    position: /** @type {[number, number, number]} */ ([
      width + 1.6,
      height + 0.8,
      depth + 1.6
    ]),
    fov: 42
  };

  return (
    <div className="absolute inset-0 bg-[var(--hc-bg)]" aria-label="3D kitchen preview">
      <Canvas shadows camera={camera}>
        <color attach="background" args={['#0f1216']} />
        <fog attach="fog" args={['#0f1216', 12, 30]} />
        <RoomLighting width={width} depth={depth} height={height} />
        <Room width={width} depth={depth} height={height} />
        {modules.map((module) => (
          <ModuleBox key={module.instanceId} module={module} />
        ))}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.05}
          target={target}
        />
      </Canvas>
    </div>
  );
}

export { FINISH_COLORS };
export { moduleCenterPosition } from './modulePose.js';
