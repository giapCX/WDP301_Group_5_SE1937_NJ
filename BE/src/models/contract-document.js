import { embedded, arrayOf } from './schema.js';

export const contractDocument = () => embedded({
  version: String, hash: String, title: String,
  facts: arrayOf(embedded({ label: String, value: String })),
  clauses: arrayOf(String),
  place: String,
  parties: arrayOf(embedded({ heading: String, facts: arrayOf(embedded({ label: String, value: String })) })),
  articles: arrayOf(embedded({ title: String, paragraphs: arrayOf(String) })),
  appendices: { type: [embedded({ title: String, facts: arrayOf(embedded({ label: String, value: String })), paragraphs: arrayOf(String) })], default: undefined },
  prepared_at: Date,
});
