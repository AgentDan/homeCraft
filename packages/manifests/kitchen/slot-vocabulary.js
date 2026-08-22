/**
 * Kitchen slot-extraction vocabulary (domain data, not core matching logic).
 * extractSlots() in packages/ai consumes this table; prefixes and keywords
 * stay here so the AI package does not know about SINK/OVEN/sink_cabinet.
 */
export const kitchenSlotVocabulary = {
  skuPrefixes: ['BASE', 'WALL', 'SINK', 'HOB', 'OVEN', 'CORNER', 'TALL', 'FRIDGE', 'DISHWASHER'],
  categoryKeywords: [
    { category: 'sink_cabinet', patterns: [/\bsink\b/i, /мойк/i, /sudoper/i, /судопер/i] },
    { category: 'wall_cabinet', patterns: [/\b(?:wall|wall-mounted|hanging)\b/i, /навесн/i, /верхн/i, /zidn[ia]/i, /viseć/i, /viseci/i, /зидн/i, /висећ/i] },
    { category: 'corner_cabinet', patterns: [/\bcorner\b/i, /углов/i, /ugaon/i, /угаон/i] },
    { category: 'tall_cabinet', patterns: [/\b(?:pantry|tall)\b/i, /пенал/i, /высок/i, /visok/i, /висок/i] },
    { category: 'drawer_cabinet', patterns: [/\bdrawer\b/i, /ящик/i, /fiok/i, /фиок/i] },
    { category: 'oven_cabinet', patterns: [/\boven\b/i, /духов/i, /rern/i, /рерн/i] },
    { category: 'hob_cabinet', patterns: [/\b(?:hob|cooktop)\b/i, /варочн/i, /ploč/i, /ploc/i, /плоч/i] }
  ],
  finishKeywords: [
    { finishId: 'oak', patterns: [/\boak\b/i, /дуб/i, /hrast/i, /храст/i] },
    { finishId: 'white', patterns: [/\bwhite\b/i, /бел/i, /bel[ae]/i, /bijel/i] }
  ],
  layoutKeywords: [
    { layout: 'starter_kitchen', patterns: [/\bkitchen\b/i, /кухн/i, /kuhinj/i, /кухињ/i] }
  ]
};
