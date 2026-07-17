/* eslint-disable react/no-unknown-property -- React Three Fiber JSX props */
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const FINISH_COLORS = {
  white: '#f5f5f4',
  oak: '#c08a4f'
};

/**
 * @typedef {{
 *   instanceId: string,
 *   finishId?: string,
 *   rotationY: number,
 *   position: { x: number, y: number, z: number },
 *   dimensions: { widthMm: number, heightMm: number, depthMm: number }
 * }} SceneModule
 */

/** @param {{ module: SceneModule }} props */
function ModuleBox({ module }) {
  const width = module.dimensions.widthMm / 1000;
  const height = module.dimensions.heightMm / 1000;
  const depth = module.dimensions.depthMm / 1000;
  const rotationY = (module.rotationY * Math.PI) / 180;
  return (
    <mesh
      position={[
        module.position.x / 1000 + width / 2,
        module.position.y / 1000 + height / 2,
        module.position.z / 1000 + depth / 2
      ]}
      rotation={[0, rotationY, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={FINISH_COLORS[module.finishId] ?? '#6d8f71'}
        roughness={0.7}
      />
    </mesh>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#1a1d22" roughness={0.95} />
    </mesh>
  );
}

/**
 * @param {{
 *   sceneResult: { projectId: string, modules?: any[] } | null,
 *   view?: { kind: '2d_plan' | '3d_scene', render: 'full' | 'delta' }
 * }} props
 */
export function ScenePreview({ sceneResult, view: _view }) {
  /** @type {SceneModule[]} */
  const modules = /** @type {SceneModule[]} */ (sceneResult?.modules ?? []);

  return (
    <div className="absolute inset-0 bg-[var(--hc-bg)]" aria-label="3D kitchen preview">
      <Canvas shadows camera={{ position: [4.2, 3.2, 5.2], fov: 42 }}>
        <color attach="background" args={['#0f1216']} />
        <fog attach="fog" args={['#0f1216', 10, 22]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[4, 8, 3]}
          intensity={1.6}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-3, 4, -2]} intensity={0.35} />
        <Floor />
        <gridHelper args={[12, 24, '#3a424c', '#232830']} position={[0, 0.01, 0]} />
        {modules.map((module) => (
          <ModuleBox key={module.instanceId} module={module} />
        ))}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={18}
          maxPolarAngle={Math.PI / 2.05}
          target={[1.2, 0.6, 0.8]}
        />
      </Canvas>
    </div>
  );
}
