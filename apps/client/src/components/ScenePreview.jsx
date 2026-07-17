/* eslint-disable react/no-unknown-property -- React Three Fiber JSX props */
import { Canvas } from '@react-three/fiber';

const FINISH_COLORS = {
  white: '#f5f5f4',
  oak: '#b7834f'
};

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
        color={FINISH_COLORS[module.finishId] ?? '#86a789'}
        roughness={0.75}
      />
    </mesh>
  );
}

export function ScenePreview({ sceneResult, view }) {
  const viewKind = view?.kind ?? '2d_plan';
  const title = viewKind === '3d_scene' ? '3D-сцена' : '2D-план';
  const modules = sceneResult?.modules ?? [];

  return (
    <section className="overflow-hidden rounded-lg border border-emerald-700 bg-emerald-50">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-medium text-emerald-950">{title}</h3>
        <span className="text-sm text-stone-600">Модулей: {modules.length}</span>
      </div>
      <div className="h-96 bg-stone-100">
        <Canvas shadows camera={{ position: [4, 3.5, 5], fov: 45 }}>
          <color attach="background" args={['#f5f5f4']} />
          <ambientLight intensity={1.4} />
          <directionalLight
            position={[3, 6, 4]}
            intensity={2}
            castShadow
          />
          <gridHelper args={[8, 16, '#a8a29e', '#d6d3d1']} />
          {modules.map((module) => (
            <ModuleBox key={module.instanceId} module={module} />
          ))}
        </Canvas>
      </div>
      {modules.length === 0 && (
        <p className="px-4 py-3 text-sm text-stone-600">
          Добавьте модуль, чтобы увидеть проект.
        </p>
      )}
    </section>
  );
}
