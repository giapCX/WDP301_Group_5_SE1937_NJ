import { Schema } from 'mongoose';

const options = {
  strict: 'throw',
  strictQuery: false,
  versionKey: false,
  autoIndex: false,
  autoCreate: false,
  bufferCommands: false,
  minimize: false,
};

export function createSchema(fields) {
  const schema = new Schema(fields, options);
  schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function () {
    this.setOptions({ runValidators: true });
  });
  return schema;
}

export const embedded = (fields) => new Schema(fields, { ...options, _id: false });
// Avoid filling absent fields on historical records and partial drafts.
export const arrayOf = (type) => ({ type: [type], default: undefined });
export const integer = (bounds = {}) => ({ type: Number, validate: Number.isSafeInteger, ...bounds });
