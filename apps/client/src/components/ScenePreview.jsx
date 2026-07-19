/* eslint-disable react/no-unknown-property -- React Three Fiber JSX props */
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DoubleSide } from 'three';

const FINISH_COLORS = {
  white: '#f5f5f4',
  oak: '#c08a4f'
};

const DEFAULT_ROOM = { widthMm: 3000, depthMm: 4000, heightMm: 2700 };

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

/**
 * Draws a 3D room (floor + back wall + left wall) sized to the room shape.
 * The room corner sits at the origin so it aligns with module placement.
 *
 * @param {{ width: number, depth: number, height: number }} props
 */
function Room({ width, depth, height }) {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[width / 2, 0, depth / 2]}
        receiveShadow
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#181b20" roughness={0.95} />
      </mesh>

      {/* Back wall (z = 0 plane) */}
      <mesh position={[width / 2, height / 2, 0]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#22262d" roughness={1} side={DoubleSide} />
      </mesh>

      {/* Left wall (x = 0 plane) */}
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[0, height / 2, depth / 2]}
        receiveShadow
      >
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color="#1e2228" roughness={1} side={DoubleSide} />
      </mesh>

      <gridHelper
        args={[Math.max(width, depth), Math.round(Math.max(width, depth) * 2), '#3a424c', '#242a32']}
        position={[width / 2, 0.01, depth / 2]}
      />
    </group>
  );
}

/**
 * Warm ceiling fixtures + fill light that read like interior room lighting.
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
      {/* Soft global fill: warm from above, cool bounce from the floor */}
      <hemisphereLight args={['#fff2dc', '#20242b', 0.55]} />
      <ambientLight intensity={0.18} />

      {fixtures.map(([x, z], index) => (
        <group key={index} position={[x, y, z]}>
          <pointLight
            color="#ffe3b8"
            intensity={6}
            distance={reach}
            decay={2}
            castShadow={index === 0}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          {/* Visible ceiling plafond */}
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.04, 20]} />
            <meshStandardMaterial
              color="#fff4e2"
              emissive="#ffdca6"
              emissiveIntensity={1.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * @param {{
 *   sceneResult: { projectId: string, modules?: any[] } | null,
 *   roomShape?: { dimensions: { widthMm: number, depthMm: number, heightMm: number } } | null,
 *   view?: { kind: '2d_plan' | '3d_scene', render: 'full' | 'delta' }
 * }} props
 */
export function ScenePreview({ sceneResult, roomShape, view: _view }) {
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
