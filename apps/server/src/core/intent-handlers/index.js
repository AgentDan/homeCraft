import { handleHistory } from './history.js';
import { handleBranch } from './branch.js';
import { handleHelp } from './help.js';
import { handleUnknown } from './unknown.js';
import { handleSetBudget } from './set-budget.js';
import { handleExportProject } from './export-project.js';

/**
 * Flat registry: intent.kind → handler. No dispatch logic here.
 * Clarify outcomes are checked in route() before this lookup.
 */
export const intentHandlers = {
  undo: handleHistory,
  redo: handleHistory,
  create_branch: handleBranch,
  switch_branch: handleBranch,
  help: handleHelp,
  unknown: handleUnknown,
  set_budget: handleSetBudget,
  export_project: handleExportProject
};
