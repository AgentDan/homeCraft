/**
 * Kitchen DP4 SKU/category mapping (domain data, not core engine logic).
 * Copied from the previous hardcoded literals in recommendation-engine.js.
 */
export const kitchenDp4SkuMap = {
  defaultSku: 'BASE-600',
  defaultCategory: 'base_cabinet',
  byFacade: { durable: 'BASE-600', soft: 'DRAWER-600', mixed: 'BASE-800' },
  lowBudgetSku: 'BASE-400',
  lowBudgetEur: 15000
};
