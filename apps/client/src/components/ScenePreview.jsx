export function ScenePreview({ sceneResult, view }) {
  const viewKind = view?.kind ?? '2d_plan';
  const title = viewKind === '3d_scene' ? '3D-сцена' : '2D-план';
  const renderMode = view?.render === 'delta' ? 'обновление' : 'полная перерисовка';
  const moduleCount = sceneResult?.modules?.length ?? 0;

  return (
    <section className="rounded-lg border border-dashed border-emerald-700 bg-emerald-50 p-6">
      <h3 className="mb-2 font-medium text-emerald-950">{title}</h3>
      <p className="text-stone-700">
        Здесь будет {title.toLowerCase()}. Сейчас: {renderMode}, модулей — {moduleCount}.
      </p>
    </section>
  );
}
