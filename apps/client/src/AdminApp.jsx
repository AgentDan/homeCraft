import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAdminJourneyQuestions,
  getAdminRecommendationRules,
  getAdminSchemaCatalog,
  putAdminJourneyQuestions,
  putAdminRecommendationRules
} from './api/client.js';

const fieldClass =
  'w-full rounded-md border border-transparent bg-[#1a1f27] px-2.5 py-1.5 text-sm text-[#f4f6f8] outline-none transition focus:border-[var(--hc-border)] focus:bg-[#222833] focus:ring-1 focus:ring-white/10 [color-scheme:dark]';

const labelClass = 'flex flex-col gap-1 text-[11px] tracking-wide text-[var(--hc-muted)]';

const linkBtnClass =
  'text-xs text-[var(--hc-muted)] underline-offset-2 hover:text-[var(--hc-text)] hover:underline';

/**
 * @param {string} value
 */
function shortLabel(value) {
  if (!value) return '—';
  if (value.startsWith('known.')) return value.slice('known.'.length);
  if (value.startsWith('decisionState.')) return value.slice('decisionState.'.length);
  return value;
}

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   badge?: string,
 *   defaultOpen?: boolean,
 *   onDelete?: () => void,
 *   children: import('react').ReactNode
 * }} props
 */
function CollapsibleCard({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  onDelete,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl bg-white/[0.035]">
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center text-[10px] text-[var(--hc-muted)] transition-transform ${
              open ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          >
            ▸
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-sm text-[var(--hc-text)] [font-family:var(--hc-mono)]"
              title={title}
            >
              {title}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block truncate text-xs text-[var(--hc-muted)]">
                {subtitle}
              </span>
            ) : null}
          </span>
          {badge ? (
            <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hc-muted)]">
              {badge}
            </span>
          ) : null}
        </button>
        {onDelete ? (
          <button
            type="button"
            className="cursor-pointer px-3 text-xs text-[var(--hc-muted)] hover:text-[var(--hc-danger)]"
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-4 border-t border-white/[0.06] px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {{ title: string, children: import('react').ReactNode }} props
 */
function Section({ title, children }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--hc-muted)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   options: string[],
 *   onChange: (value: string) => void,
 *   allowEmpty?: boolean,
 *   emptyLabel?: string,
 *   shorten?: boolean
 * }} props
 */
function CatalogSelect({
  label,
  value,
  options,
  onChange,
  allowEmpty = false,
  emptyLabel = '—',
  shorten = false
}) {
  return (
    <label className={labelClass} title={value || undefined}>
      <span>{label}</span>
      <select
        className={`${fieldClass} cursor-pointer`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty ? (
          <option value="" className="bg-[#1a1f27] text-[#f4f6f8]">
            {emptyLabel}
          </option>
        ) : null}
        {options.map((option) => (
          <option
            key={option}
            value={option}
            title={option}
            className="bg-[#1a1f27] text-[#f4f6f8]"
          >
            {shorten ? shortLabel(option) : option}
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
    <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]">
      <CatalogSelect
        label="Field"
        value={atomic.field}
        options={catalog.conditionFields}
        shorten
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
        <label className={labelClass}>
          <span>Value</span>
          <input
            type="number"
            className={fieldClass}
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
          shorten
          onChange={(value) => onChange({ ...atomic, value })}
        />
      )}
      {onRemove ? (
        <button type="button" className={`${linkBtnClass} pb-2`} onClick={onRemove}>
          Remove
        </button>
      ) : (
        <span />
      )}
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

/** @type {Record<string, { stage: string, i18nKey: string, validation: Record<string, unknown> }>} */
const QUESTION_SLOT_DEFAULTS = {
  clientName: {
    stage: 'intro',
    i18nKey: 'journeyAskClientName',
    validation: {
      type: 'text',
      minLength: 1,
      maxLength: 80,
      rejectIfNumeric: true
    }
  },
  projectGoal: {
    stage: 'brief',
    i18nKey: 'journeyAskProjectGoal',
    validation: { type: 'text', minLength: 2, maxLength: 240 }
  },
  roomWidthMm: {
    stage: 'survey',
    i18nKey: 'journeyAskRoomWidth',
    validation: { type: 'dimension', min: 500, max: 20000, unit: 'mm', acceptNlu: true }
  },
  roomDepthMm: {
    stage: 'survey',
    i18nKey: 'journeyAskRoomDepth',
    validation: { type: 'dimension', min: 500, max: 20000, unit: 'mm', acceptNlu: true }
  },
  hasKidsOrPets: {
    stage: 'survey',
    i18nKey: 'journeyAskHasKidsOrPets',
    validation: { type: 'enum', options: ['yes', 'no'] }
  },
  facadeMaterialPreference: {
    stage: 'survey',
    i18nKey: 'journeyAskFacadeMaterial',
    validation: { type: 'enum', options: ['durable', 'soft', 'mixed'] }
  },
  shoppingHabit: {
    stage: 'survey',
    i18nKey: 'journeyAskShoppingHabit',
    validation: { type: 'enum', options: ['browse', 'decide_fast', 'research'] }
  },
  socialStyle: {
    stage: 'survey',
    i18nKey: 'journeyAskSocialStyle',
    validation: { type: 'enum', options: ['private', 'hosting', 'family'] }
  },
  budgetEur: {
    stage: 'survey',
    i18nKey: 'journeyAskBudgetEur',
    validation: { type: 'number', min: 100, max: 1_000_000, integer: true }
  }
};

const MANDATORY_RULE_IDS = new Set([
  'explicit_answer_wins_over_behavior',
  'conflicting_behavior_becomes_alternative',
  'default_no_special_conditions'
]);

/**
 * @param {string} slot
 * @param {number} order
 * @param {Record<string, any>} catalog
 */
function createQuestionForSlot(slot, order, catalog) {
  const preset = QUESTION_SLOT_DEFAULTS[slot];
  const enumOpts = catalog.enumOptionsBySlot?.[slot];
  return {
    id: slot,
    slot,
    stage: preset?.stage ?? catalog.journeyStages?.[0] ?? 'survey',
    order,
    i18nKey: preset?.i18nKey ?? catalog.i18nKeys?.[0] ?? 'journeyAskClientName',
    validation: preset?.validation
      ? structuredClone(preset.validation)
      : enumOpts
        ? { type: 'enum', options: [...enumOpts] }
        : defaultValidation('text'),
    dependsOn: null,
    active: true
  };
}

/**
 * @param {any[]} rules
 * @param {Record<string, any>} catalog
 */
function createBlankRule(rules, catalog) {
  const used = new Set(rules.map((rule) => rule.ruleId));
  let n = 1;
  let ruleId = `custom_rule_${n}`;
  while (used.has(ruleId)) {
    n += 1;
    ruleId = `custom_rule_${n}`;
  }
  const maxPriority = rules.reduce(
    (max, rule) => (typeof rule.priority === 'number' ? Math.max(max, rule.priority) : max),
    0
  );
  return {
    ruleId,
    priority: maxPriority >= 999 ? maxPriority + 1 : Math.max(10, maxPriority + 10),
    condition: {
      field: catalog.conditionFields[0],
      operator: 'exists',
      value: true
    },
    action: {
      type: 'filterCatalog',
      filters: { sku: catalog.filterSkus[0] }
    },
    active: true
  };
}

/**
 * @param {{
 *   catalog: Record<string, any>,
 *   questions: any[],
 *   onChange: (questions: any[]) => void
 * }} props
 */
function QuestionsPanel({ catalog, questions, onChange }) {
  const usedSlots = new Set(questions.map((question) => question.slot));
  const freeSlots = (catalog.knownSlots ?? []).filter((slot) => !usedSlots.has(slot));

  const updateAt = (index, patch) => {
    const next = questions.map((question, i) =>
      i === index ? { ...question, ...patch } : question
    );
    onChange(next);
  };

  const addQuestion = () => {
    if (freeSlots.length === 0) return;
    const slot = freeSlots[0];
    const maxOrder = questions.reduce(
      (max, question) =>
        typeof question.order === 'number' ? Math.max(max, question.order) : max,
      0
    );
    onChange([
      ...questions,
      createQuestionForSlot(slot, maxOrder + 10, catalog)
    ]);
  };

  const removeAt = (index) => {
    const target = questions[index];
    if (!target) return;
    const ok = window.confirm(
      `Delete question "${target.slot}"?\nSave to persist. Prefer Active=off if unsure.`
    );
    if (!ok) return;
    onChange(
      questions
        .filter((_question, i) => i !== index)
        .map((question) =>
          question.dependsOn?.slot === target.slot
            ? { ...question, dependsOn: null }
            : question
        )
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <p className="text-xs text-[var(--hc-muted)]">
          {freeSlots.length > 0
            ? `${freeSlots.length} free slot(s) in catalog`
            : 'All catalog slots are used'}
        </p>
        <button
          type="button"
          className={`${linkBtnClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-40`}
          disabled={freeSlots.length === 0}
          onClick={addQuestion}
        >
          + Add question
        </button>
      </div>

      {questions.map((question, index) => {
        const earlierSlots = questions
          .filter((item) => item.order < question.order)
          .map((item) => item.slot);
        const enumOpts =
          catalog.enumOptionsBySlot?.[question.slot]
          ?? catalog.enumOptionsBySlot?.hasKidsOrPets
          ?? [];
        const slotOptions = [
          question.slot,
          ...freeSlots.filter((slot) => slot !== question.slot)
        ];

        return (
          <CollapsibleCard
            key={`${question.slot}-${index}`}
            title={question.slot}
            subtitle={`${question.stage} · ${question.i18nKey} · order ${question.order}`}
            badge={question.active ? 'active' : 'off'}
            onDelete={() => removeAt(index)}
          >
            <Section title="Meta">
              <div className="grid gap-3 md:grid-cols-4">
                <CatalogSelect
                  label="Slot / id"
                  value={question.slot}
                  options={slotOptions}
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
                          : QUESTION_SLOT_DEFAULTS[slot]
                            ? structuredClone(QUESTION_SLOT_DEFAULTS[slot].validation)
                            : question.validation,
                      i18nKey:
                        QUESTION_SLOT_DEFAULTS[slot]?.i18nKey ?? question.i18nKey,
                      stage: QUESTION_SLOT_DEFAULTS[slot]?.stage ?? question.stage
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
                <label className={labelClass}>
                  <span>Order</span>
                  <input
                    type="number"
                    className={fieldClass}
                    value={question.order}
                    onChange={(event) =>
                      updateAt(index, { order: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-[var(--hc-text)]">
                <input
                  type="checkbox"
                  checked={question.active}
                  onChange={(event) =>
                    updateAt(index, { active: event.target.checked })
                  }
                />
                Active
              </label>
            </Section>

            <div className="border-t border-white/[0.06] pt-4">
              <Section title="Validation">
                <div className="grid gap-3 md:grid-cols-3">
                  <CatalogSelect
                    label="Type"
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
                    <label className={`${labelClass} md:col-span-2`}>
                      <span>Enum options</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
                        {enumOpts.map((option) => {
                          const checked = (question.validation.options ?? []).includes(
                            option
                          );
                          return (
                            <label
                              key={option}
                              className="flex items-center gap-1.5 text-sm text-[var(--hc-text)]"
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
                                      options: options.length
                                        ? options
                                        : [enumOpts[0]]
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
              </Section>
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              <Section title="Depends on">
                <div className="grid gap-3 md:grid-cols-3">
                  <CatalogSelect
                    label="Slot"
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
                        label="Operator"
                        value={question.dependsOn.operator}
                        options={catalog.dependsOnOperators}
                        onChange={(operator) =>
                          updateAt(index, {
                            dependsOn: { ...question.dependsOn, operator }
                          })
                        }
                      />
                      <CatalogSelect
                        label="Value"
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
                </div>
              </Section>
            </div>
          </CollapsibleCard>
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

  /**
   * @param {any} rule
   * @param {string} kind
   */
  function ruleSubtitle(rule, kind) {
    const action =
      rule.action?.type === 'triggerDialogueAction'
        ? `dialogue:${rule.action.topic}`
        : `filter:${Object.keys(rule.action?.filters ?? {})[0] ?? '?'}`;
    return `priority ${rule.priority} · ${kind} · ${action}`;
  }

  const addRule = () => {
    onChange([...rules, createBlankRule(rules, catalog)]);
  };

  const removeAt = (index) => {
    const target = rules[index];
    if (!target) return;
    const mandatory = MANDATORY_RULE_IDS.has(target.ruleId);
    const ok = window.confirm(
      mandatory
        ? `Delete mandatory rule "${target.ruleId}"?\nDP4 may behave differently. Save to persist.`
        : `Delete rule "${target.ruleId}"?\nSave to persist.`
    );
    if (!ok) return;
    onChange(rules.filter((_rule, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <p className="text-xs text-[var(--hc-muted)]">
          {rules.length} rule(s) · Save writes recommendation-rules.json
        </p>
        <button
          type="button"
          className={`${linkBtnClass} cursor-pointer`}
          onClick={addRule}
        >
          + Add rule
        </button>
      </div>

      {rules.map((rule, index) => {
        const kind = conditionKind(rule.condition);
        return (
          <CollapsibleCard
            key={`${rule.ruleId}-${index}`}
            title={rule.ruleId}
            subtitle={ruleSubtitle(rule, kind)}
            badge={rule.active ? 'active' : 'off'}
            onDelete={() => removeAt(index)}
          >
            <Section title="Meta">
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto]">
                <label className={labelClass} title={rule.ruleId}>
                  <span>Rule id</span>
                  <input
                    className={`${fieldClass} [font-family:var(--hc-mono)]`}
                    value={rule.ruleId}
                    onChange={(event) =>
                      updateAt(index, { ruleId: event.target.value })
                    }
                  />
                </label>
                <label className={labelClass}>
                  <span>Priority</span>
                  <input
                    type="number"
                    className={fieldClass}
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
                <label className="flex items-end gap-2 pb-2 text-sm text-[var(--hc-text)]">
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
            </Section>

            <div className="border-t border-white/[0.06] pt-4">
              <Section title="When">
                {kind === 'always' ? (
                  <p className="text-sm text-[var(--hc-muted)]">Always matches.</p>
                ) : null}
                {kind === 'atomic' ? (
                  <AtomicConditionEditor
                    catalog={catalog}
                    atomic={rule.condition}
                    onChange={(condition) => updateAt(index, { condition })}
                  />
                ) : null}
                {kind === 'allOf' || kind === 'anyOf' ? (
                  <div className="space-y-3">
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
                        className={linkBtnClass}
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
                        + Add condition (max 3)
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </Section>
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              <Section title="Then">
                <div className="grid gap-3 md:grid-cols-3">
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
                          if (key === 'category') {
                            value = catalog.filterCategories[0];
                          }
                          if (key === 'preferFrom') {
                            value = catalog.filterPreferFrom[0];
                          }
                          if (key === 'finishId') value = catalog.finishIds[0];
                          updateAt(index, {
                            action: {
                              type: 'filterCatalog',
                              filters: { [key]: value }
                            }
                          });
                        }}
                      />
                      <CatalogSelect
                        label="Filter value"
                        value={Object.values(rule.action.filters ?? {})[0] ?? ''}
                        options={(() => {
                          const key =
                            Object.keys(rule.action.filters ?? {})[0] ?? 'sku';
                          if (key === 'category') return catalog.filterCategories;
                          if (key === 'preferFrom') return catalog.filterPreferFrom;
                          if (key === 'finishId') return catalog.finishIds;
                          return catalog.filterSkus;
                        })()}
                        onChange={(value) => {
                          const key =
                            Object.keys(rule.action.filters ?? {})[0] ?? 'sku';
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
              </Section>
            </div>
          </CollapsibleCard>
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
        {error || 'Loading admin…'}
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-auto bg-[var(--hc-bg)] text-[var(--hc-text)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium tracking-wide">HomeCraft Admin</h1>
            <p className="text-sm text-[var(--hc-muted)]">
              Dropdown-only constructors. Expand a block to edit.
            </p>
          </div>
          <a
            href="#/"
            className="text-sm text-[var(--hc-muted)] underline-offset-2 hover:text-[var(--hc-text)] hover:underline"
          >
            Back to app
          </a>
        </header>

        <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] pb-3">
          <button
            type="button"
            className={`cursor-pointer pb-2 text-sm transition ${
              tab === 'questions'
                ? 'border-b-2 border-[var(--hc-text)] text-[var(--hc-text)]'
                : 'border-b-2 border-transparent text-[var(--hc-muted)] hover:text-[var(--hc-text)]'
            }`}
            onClick={() => setTab('questions')}
          >
            Journey questions
          </button>
          <button
            type="button"
            className={`cursor-pointer pb-2 text-sm transition ${
              tab === 'rules'
                ? 'border-b-2 border-[var(--hc-text)] text-[var(--hc-text)]'
                : 'border-b-2 border-transparent text-[var(--hc-muted)] hover:text-[var(--hc-text)]'
            }`}
            onClick={() => setTab('rules')}
          >
            Recommendation rules
          </button>
          <button
            type="button"
            className="ml-auto cursor-pointer rounded-md bg-white/[0.08] px-3 py-1.5 text-sm text-[var(--hc-text)] hover:bg-white/[0.12]"
            onClick={() => void save()}
          >
            Save {title.toLowerCase()}
          </button>
        </div>

        {status ? (
          <p className="text-sm text-[var(--hc-muted)]">{status}</p>
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
