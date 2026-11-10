import { embedded, arrayOf } from './schema.js';

export const contractDocument = () => embedded({
  version: String, hash: String, title: String,
  facts: arrayOf(embedded({ label: String, value: String })),
  clauses: arrayOf(String), prepared_at: Date,
});
