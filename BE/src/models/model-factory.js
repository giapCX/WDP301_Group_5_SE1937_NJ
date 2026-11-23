const mongoose = require('mongoose');

function createModel(name, collection, fields, relations = [], indexes = []) {
  const schema = new mongoose.Schema(fields, {
    collection,
    versionKey: false,
    timestamps: false,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  });
  for (const relation of relations) {
    schema.virtual(relation.name, {
      ref: relation.model,
      localField: relation.localField,
      foreignField: relation.foreignField,
      justOne: true,
    });
  }
  for (const index of indexes) {
    schema.index(index.fields, index.options);
  }
  return mongoose.models[name] || mongoose.model(name, schema);
}

module.exports = {
  createModel,
};
