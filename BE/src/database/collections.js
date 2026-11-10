import { getModels } from '../models/index.js';
export { collections, openInspectionIndex } from './indexes.js';

export async function initializeCollections(connection) {
  for (const Model of Object.values(getModels(connection))) {
    await Model.createCollection();
    // createIndexes adds declared indexes; unlike syncIndexes it never drops existing ones.
    await Model.createIndexes();
  }
}