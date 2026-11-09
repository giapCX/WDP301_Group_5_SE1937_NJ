// Shared Mongoose persistence operations. Reads return plain objects so API
// serializers and workflow comparisons do not depend on hydrated documents.
export function createModelRepository(Model) {
  return {
    find: (filter = {}, { projection, ...options } = {}) => Model.find(filter, projection, options).lean(),
    findOne: (filter = {}, { projection, ...options } = {}) => Model.findOne(filter, projection, options).lean(),
    countDocuments: (filter = {}) => Model.countDocuments(filter),
    aggregate: (pipeline) => Model.aggregate(pipeline),
    async create(document, options = {}) {
      const saved = await new Model(document).save(options);
      return saved.toObject();
    },
    updateOne: (filter, update, options = {}) => Model.updateOne(filter, update, options),
    updateMany: (filter, update, options = {}) => Model.updateMany(filter, update, options),
    findOneAndUpdate: (filter, update, options = {}) => Model.findOneAndUpdate(filter, update, options).lean(),
    ensureIndexes: () => Model.createIndexes(),
  };
}
