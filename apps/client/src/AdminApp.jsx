import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminJourneyQuestions,
  getAdminRecommendationRules,
  getAdminSchemaCatalog,
  putAdminJourneyQuestions,
  putAdminRecommendationRules
} from './api/client.js';

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   options: string[],
 *   onChange: (value: string) => void,
 *   allowEmpty?: boolean,
 *   emptyLabel?: string
 * }} props
 */
function CatalogSelect({
  label,
  value,
  options,
  onChange,
  allowEmpty = false,
  emptyLabel = '—'
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--hc-muted)]">
      <span>{label}</span>
      <select
        className="rounded-lg border border-[var(--hc-border)] bg-black/40 px-2 py-1.5 text-sm text-[var(--hc-text)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * @param {string} field
 * @param {Record<string, string[]>} enumOptionsBySlot
 * @returns {string[] | null}
 */
function valueOptionsForField(field, enumOptionsBySlot) {
  if (field === 'decisionState.phase' || field === 'phase') {
    return ['intro', 'brief', 'survey', 'post_survey'];
  }
  if (field === 'decisionState.journeyMode') {
    return ['guided', 'free'];
  }
  if (field.startsWith('known.')) {
    const slot = field.slice('known.'.length);
    return enumOptionsBySlot[slot] ?? null;
  }
  return null;
}

function isNumericField(field) {
  return (
    field.endsWith('budgetEur')
    || field.endsWith('budgetAnchor')
    || field.endsWith('roomWidthMm')
    || field.endsWith('roomDepthMm')
    || field.endsWith('readinessScore')
  );
}

/**
 * @param {{
 *   catalog: Record<string, any>,
 *   atomic: { field: string, operator: string, value: unknown },
 *   onChange: (next: { field: string, operator: string, value: unknown }) => void,
 *   onRemove?: () => void
 * }} props
 */
function AtomicConditionEditor({ catalog, atomic, onChange, onRemove }) {
  const valueOptions = valueOptionsForField(
    atomic.field,
    catalog.enumOptionsBySlot ?? {}
  );
  const isExists = atomic.operator === 'exists';
  const isNumeric =
    ['gt', 'gte', 'lt', 'lte'].includes(atomic.operator)
    || isNumericField(atomic.field);

  return (
    <div className="grid gap-2 rounded-lg border border-[var(--hc-border)] bg-black/25 p-2 md:grid-cols-4">
      <CatalogSelect
        label="Field"
        value={atomic.field}
        options={catalog.conditionFields}
        onChange={(field) =>
          onChange({
            ...atomic,
            field,
            value:
              valueOptionsForField(field, catalog.enumOptionsBySlot)?.[0]
              ?? (isNumericField(field) ? 0 : true)
          })
        }
      />
      <CatalogSelect
        label="Operator"
        value={atomic.operator}
        options={catalog.conditionOperators}
        onChange={(operator) =>
          onChange({
            ...atomic,
            operator,
            value: operator === 'exists' ? true : atomic.value
          })
        }
      />
      {isExists ? (
        <CatalogSelect
          label="Value"
          value={String(atomic.value === false ? 'false' : 'true')}
          options={['true', 'false']}
          onChange={(value) => onChange({ ...atomic, value: value === 'true' })}
        />
      ) : valueOptions ? (
        <CatalogSelect
          label="Value"
          value={String(atomic.value ?? '')}
          options={valueOptions}
          onChange={(value) => onChange({ ...atomic, value })}
        />
      ) : isNumeric ? (
        <label className="flex flex-col gap-1 text-xs text-[var(--hc-muted)]">
          <span>Value</span>
          <input
            type="number"
            className="rounded-lg border border-[var(--hc-border)] bg-black/40 px-2 py-1.5 text-sm text-[var(--hc-text)]"
            value={typeof atomic.value === 'number' ? atomic.value : 0}
            onChange={(event) =>
              onChange({ ...atomic, value: Number(event.target.value) })
            }
          />
        </label>
      ) : (
        <CatalogSelect
          label="Value"
          value={String(atomic.value ?? catalog.conditionFields[0] ?? '')}
          options={catalog.conditionFields}
          onChange={(value) => onChange({ ...atomic, value })}
        />
      )}
      {onRemove ? (
        <button
          type="button"
          className="self-end rounded-lg border border-[var(--hc-border)] px-2 py-1.5 text-xs text-[var(--hc-muted)] hover:text-[var(--hc-text)]"
          onClick={onRemove}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

function defaultValidation(type) {
  if (type === 'text') {
    return { type: 'text', minLength: 1, maxLength: 80, rejectIfNumeric: false };
  }
  if (type === 'number') {
    return { type: 'number', min: 0, max: 1_000_000, integer: true };
  }
  if (type === 'enum') {
    return { type: 'enum', options: ['yes', 'no'] };
  }
  return { type: 'dimension', min: 500, max: 20000, unit: 'mm', acceptNlu: true };
}

/**
 * @param {{
 *   catalog: Record<string, any>,
 *   questions: any[],
 *   onChange: (questions: any[]) => void
 * }} props
 */
function QuestionsPanel({ catalog, questions, onChange }) {
  const updateAt = (index, patch) => {
    const next = questions.map((question, i) =>
      i === index ? { ...question, ...patch } : question
    );
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const earlierSlots = questions
          .filter((item) => item.order < question.order)
          .map((item) => item.slot);
        const enumOpts =
          catalog.enumOptionsBySlot?.[question.slot] ?? catalog.enumOptionsBySlot?.hasKidsOrPets ?? [];

        return (
          <div
            key={`${question.slot}-${index}`}
            className="hc-glass space-y-3 p-3"
          >
            <div className="grid gap-2 md:grid-cols-4">
              <CatalogSelect
                label="Slot / id"
                value={question.slot}
                options={catalog.knownSlots}
                onChange={(slot) =>
                  updateAt(index, {
                    slot,
                    id: slot,
                    validation:
                      catalog.enumOptionsBySlot?.[slot]
                        ? {
                            type: 'enum',
                            options: [...catalog.enumOptionsBySlot[slot]]
                          }
                        : question.validation
                  })
                }
              />
              <CatalogSelect
                label="Stage"
                value={question.stage}
                options={catalog.journeyStages}
                onChange={(stage) => updateAt(index, { stage })}
              />
              <CatalogSelect
                label="i18n key"
                value={question.i18nKey}
                options={catalog.i18nKeys}
                onChange={(i18nKey) => updateAt(index, { i18nKey })}
              />
              <label className="flex flex-col gap-1 text-xs text-[var(--hc-muted)]">
                <span>Order</span>
                <input
                  type="number"
                  className="rounded-lg border border-[var(--hc-border)] bg-black/40 px-2 py-1.5 text-sm text-[var(--hc-text)]"
                  value={question.order}
                  onChange={(event) =>
                    updateAt(index, { order: Number(event.target.value) })
                  }
                />
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <CatalogSelect
                label="Validation type"
                value={question.validation.type}
                options={catalog.validationTypes}
                onChange={(type) =>
                  updateAt(index, { validation: defaultValidation(type) })
                }
              />
              {question.validation.type === 'dimension' ? (
                <CatalogSelect
                  label="Unit"
                  value={question.validation.unit}
                  options={catalog.dimensionUnits}
                  onChange={(unit) =>
                    updateAt(index, {
                      validation: { ...question.validation, unit }
                    })
                  }
                />
              ) : null}
              {question.validation.type === 'enum' ? (
                <label className="flex flex-col gap-1 text-xs text-[var(--hc-muted)] md:col-span-2">
                  <span>Enum options (catalog)</span>
                  <div className="flex flex-wrap gap-2">
                    {enumOpts.map((option) => {
                      const checked = (question.validation.options ?? []).includes(
                        option
                      );
                      return (
                        <label
                          key={option}
                          className="flex items-center gap-1 text-sm text-[var(--hc-text)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const current = question.validation.options ?? [];
                              const options = checked
                                ? current.filter((item) => item !== option)
                                : [...current, option];
                              updateAt(index, {
                                validation: {
                                  ...question.validation,
                                  options: options.length ? options : [enumOpts[0]]
                                }
                              });
                            }}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                </label>
              ) : null}
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <CatalogSelect
                label="dependsOn slot"
                value={question.dependsOn?.slot ?? ''}
                options={earlierSlots}
                allowEmpty
                emptyLabel="None"
                onChange={(slot) => {
                  if (!slot) {
                    updateAt(index, { dependsOn: null });
                    return;
                  }
                  const opts = catalog.enumOptionsBySlot?.[slot] ?? ['yes'];
                  updateAt(index, {
                    dependsOn: {
                      slot,
                      operator: 'equals',
                      value: opts[0]
                    }
                  });
                }}
              />
              {question.dependsOn ? (
                <>
                  <CatalogSelect
                    label="dependsOn operator"
                    value={question.dependsOn.operator}
                    options={catalog.dependsOnOperators}
                    onChange={(operator) =>
                      updateAt(index, {
                        dependsOn: { ...question.dependsOn, operator }
                      })
                    }
                  />
                  <CatalogSelect
                    label="dependsOn value"
                    value={String(question.dependsOn.value)}
                    options={
                      catalog.enumOptionsBySlot?.[question.dependsOn.slot] ?? [
                        String(question.dependsOn.value)
                      ]
                    }
                    onChange={(value) =>
                      updateAt(index, {
                        dependsOn: { ...question.dependsOn, value }
                      })
                    }
                  />
                </>
              ) : null}
              <label className="flex items-end gap-2 pb-1 text-sm text-[var(--hc-text)]">
                <input
                  type="checkbox"
                  checked={question.active}
                  onChange={(event) =>
                    updateAt(index, { active: event.target.checked })
                  }
                />
                Active
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   catalog: Record<string, any>,
 *   rules: any[],
 *   onChange: (rules: any[]) => void
 * }} props
 */
function RulesPanel({ catalog, rules, onChange }) {
  const updateAt = (index, patch) => {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  const conditionKind = (condition) => {
    if (condition?.always) return 'always';
    if (condition?.allOf) return 'allOf';
    if (condition?.anyOf) return 'anyOf';
    return 'atomic';
  };

  return (
    <div className="space-y-3">
      {rules.map((rule, index) => {
        const kind = conditionKind(rule.condition);
        return (
          <div key={rule.ruleId} className="hc-glass space-y-3 p-3">
            <div className="grid gap-2 md:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs text-[var(--hc-muted)]">
                <span>Rule id</span>
                <input
                  className="rounded-lg border border-[var(--hc-border)] bg-black/40 px-2 py-1.5 text-sm text-[var(--hc-text)]"
                  value={rule.ruleId}
                  onChange={(event) =>
                    updateAt(index, { ruleId: event.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--hc-muted)]">
                <span>Priority</span>
                <input
                  type="number"
                  className="rounded-lg border border-[var(--hc-border)] bg-black/40 px-2 py-1.5 text-sm text-[var(--hc-text)]"
                  value={rule.priority}
                  onChange={(event) =>
                    updateAt(index, { priority: Number(event.target.value) })
                  }
                />
              </label>
              <CatalogSelect
                label="Condition kind"
                value={kind}
                options={catalog.conditionKinds}
                onChange={(nextKind) => {
                  if (nextKind === 'always') {
                    updateAt(index, { condition: { always: true } });
                  } else if (nextKind === 'allOf' || nextKind === 'anyOf') {
                    updateAt(index, {
                      condition: {
                        [nextKind]: [
                          {
                            field: catalog.conditionFields[0],
                            operator: 'exists',
                            value: true
                          }
                        ]
                      }
                    });
                  } else {
                    updateAt(index, {
                      condition: {
                        field: catalog.conditionFields[0],
                        operator: 'exists',
                        value: true
                      }
                    });
                  }
                }}
              />
              <label className="flex items-end gap-2 pb-1 text-sm text-[var(--hc-text)]">
                <input
                  type="checkbox"
                  checked={rule.active}
                  onChange={(event) =>
                    updateAt(index, { active: event.target.checked })
                  }
                />
                Active
              </label>
            </div>

            {kind === 'atomic' ? (
              <AtomicConditionEditor
                catalog={catalog}
                atomic={rule.condition}
                onChange={(condition) => updateAt(index, { condition })}
              />
            ) : null}
            {kind === 'allOf' || kind === 'anyOf' ? (
              <div className="space-y-2">
                {(rule.condition[kind] ?? []).map((atomic, atomicIndex) => (
                  <AtomicConditionEditor
                    key={`${rule.ruleId}-${atomicIndex}`}
                    catalog={catalog}
                    atomic={atomic}
                    onChange={(nextAtomic) => {
                      const list = [...rule.condition[kind]];
                      list[atomicIndex] = nextAtomic;
                      updateAt(index, { condition: { [kind]: list } });
                    }}
                    onRemove={
                      rule.condition[kind].length > 1
                        ? () => {
                            const list = rule.condition[kind].filter(
                              (_item, i) => i !== atomicIndex
                            );
                            updateAt(index, { condition: { [kind]: list } });
                          }
                        : undefined
                    }
                  />
                ))}
                {(rule.condition[kind] ?? []).length < 3 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--hc-border)] px-2 py-1 text-xs text-[var(--hc-muted)] hover:text-[var(--hc-text)]"
                    onClick={() => {
                      const list = [
                        ...(rule.condition[kind] ?? []),
                        {
                          field: catalog.conditionFields[0],
                          operator: 'exists',
                          value: true
                        }
                      ];
                      updateAt(index, { condition: { [kind]: list } });
                    }}
                  >
                    Add condition (max 3)
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2 md:grid-cols-3">
              <CatalogSelect
                label="Action type"
                value={rule.action.type}
                options={catalog.actionTypes}
                onChange={(type) => {
                  if (type === 'triggerDialogueAction') {
                    updateAt(index, {
                      action: {
                        type,
                        topic: catalog.dialogueTopics[0]
                      }
                    });
                  } else {
                    updateAt(index, {
                      action: {
                        type: 'filterCatalog',
                        filters: { sku: catalog.filterSkus[0] }
                      }
                    });
                  }
                }}
              />
              {rule.action.type === 'triggerDialogueAction' ? (
                <CatalogSelect
                  label="Topic"
                  value={rule.action.topic}
                  options={catalog.dialogueTopics}
                  onChange={(topic) =>
                    updateAt(index, { action: { ...rule.action, topic } })
                  }
                />
              ) : (
                <>
                  <CatalogSelect
                    label="Filter key"
                    value={Object.keys(rule.action.filters ?? {})[0] ?? 'sku'}
                    options={catalog.filterKeys}
                    onChange={(key) => {
                      let value = catalog.filterSkus[0];
                      if (key === 'category') value = catalog.filterCategories[0];
                      if (key === 'preferFrom') value = catalog.filterPreferFrom[0];
                      if (key === 'finishId') value = catalog.finishIds[0];
                      updateAt(index, {
                        action: { type: 'filterCatalog', filters: { [key]: value } }
                      });
                    }}
                  />
                  <CatalogSelect
                    label="Filter value"
                    value={Object.values(rule.action.filters ?? {})[0] ?? ''}
                    options={(() => {
                      const key = Object.keys(rule.action.filters ?? {})[0] ?? 'sku';
                      if (key === 'category') return catalog.filterCategories;
                      if (key === 'preferFrom') return catalog.filterPreferFrom;
                      if (key === 'finishId') return catalog.finishIds;
                      return catalog.filterSkus;
                    })()}
                    onChange={(value) => {
                      const key = Object.keys(rule.action.filters ?? {})[0] ?? 'sku';
                      updateAt(index, {
                        action: {
                          type: 'filterCatalog',
                          filters: { [key]: value }
                        }
                      });
                    }}
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminApp() {
  const [tab, setTab] = useState(/** @type {'questions' | 'rules'} */ ('questions'));
  const [catalog, setCatalog] = useState(/** @type {Record<string, any> | null} */ (null));
  const [questions, setQuestions] = useState(/** @type {any[]} */ ([]));
  const [rules, setRules] = useState(/** @type {any[]} */ ([]));
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catalogRes, questionsRes, rulesRes] = await Promise.all([
        getAdminSchemaCatalog(),
        getAdminJourneyQuestions(),
        getAdminRecommendationRules()
      ]);
      setCatalog(catalogRes.catalog);
      setQuestions(questionsRes.questions ?? []);
      setRules(rulesRes.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const title = useMemo(
    () => (tab === 'questions' ? 'Journey questions' : 'Recommendation rules'),
    [tab]
  );

  const save = async () => {
    setStatus('');
    setError('');
    try {
      if (tab === 'questions') {
        const result = await putAdminJourneyQuestions(questions);
        setQuestions(result.questions ?? questions);
        setStatus(`Saved questions (${result.persisted}).`);
      } else {
        const result = await putAdminRecommendationRules(rules);
        setRules(result.rules ?? rules);
        setStatus(`Saved rules (${result.persisted}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading || !catalog) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--hc-bg)] text-[var(--hc-muted)]">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-auto bg-[var(--hc-bg)] text-[var(--hc-text)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium tracking-wide">HomeCraft Admin</h1>
            <p className="text-sm text-[var(--hc-muted)]">
              Dropdown-only constructors (schema catalog from Ф1/Ф3). No free-text fields.
            </p>
          </div>
          <a
            href="#/"
            className="text-sm text-[var(--hc-accent)] hover:underline"
          >
            Back to app
          </a>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === 'questions'
                ? 'bg-[var(--hc-accent)] text-[#04140a]'
                : 'border border-[var(--hc-border)] text-[var(--hc-muted)]'
            }`}
            onClick={() => setTab('questions')}
          >
            Journey questions
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === 'rules'
                ? 'bg-[var(--hc-accent)] text-[#04140a]'
                : 'border border-[var(--hc-border)] text-[var(--hc-muted)]'
            }`}
            onClick={() => setTab('rules')}
          >
            Recommendation rules
          </button>
          <button
            type="button"
            className="hc-btn-accent ml-auto px-3 py-1.5 text-sm"
            onClick={() => void save()}
          >
            Save {title.toLowerCase()}
          </button>
        </div>

        {status ? (
          <p className="text-sm text-[var(--hc-accent)]">{status}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-[var(--hc-danger)]">{error}</p>
        ) : null}

        {tab === 'questions' ? (
          <QuestionsPanel
            catalog={catalog}
            questions={questions}
            onChange={setQuestions}
          />
        ) : (
          <RulesPanel catalog={catalog} rules={rules} onChange={setRules} />
        )}
      </div>
    </div>
  );
}
