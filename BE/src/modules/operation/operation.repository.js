import { getModels, modelDefinitions } from '../../models/index.js';

function createCursor(Model, filter) {
  let query = Model.find(filter).lean();
  const cursor = {
    sort(sortBy) {
      query = query.sort(sortBy);
      return cursor;
    },
    skip(count) {
      query = query.skip(count);
      return cursor;
    },
    limit(count) {
      query = query.limit(count);
      return cursor;
    },
    project(projection) {
      query = query.select(projection);
      return cursor;
    },
    toArray() {
      return query.exec();
    },
  };
  return cursor;
}

export function createOperationRepository(connection) {
  // Keep the Operation service's collection-style API on top of the shared Mongoose models.
  const models = getModels(connection);
  const collections = Object.fromEntries(
    Object.entries(modelDefinitions).map(([name, definition]) => [definition.collection, models[name]]),
  );
  const modelFor = (name) => {
    const Model = collections[name];
    if (!Model) throw new Error(`Unknown operation collection: ${name}`);
    return Model;
  };
  const collection = (name) => {
    const Model = modelFor(name);
    return {
      find: (filter = {}) => createCursor(Model, filter),
      findOne: (filter = {}) => Model.findOne(filter).lean().exec(),
      countDocuments: (filter = {}) => Model.countDocuments(filter).exec(),
      updateOne: (filter, update) => Model.updateOne(filter, update).exec(),
      insertOne: (document) => Model.create(document),
    };
  };

  // Shared query helpers for paginated queues and atomic status changes.
  return {
    collection,
    findMany: (name, filter, { page, limit, sortBy }) =>
      modelFor(name).find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit).lean().exec(),
    count: (name, filter) => modelFor(name).countDocuments(filter).exec(),
    findById: (name, id) => modelFor(name).findOne({ _id: id }).lean().exec(),
    updateOne: (name, filter, update) => modelFor(name).updateOne(filter, update).exec(),
    updateMany: (name, filter, update) => modelFor(name).updateMany(filter, update).exec(),
    insertOne: (name, document) => modelFor(name).create(document),
  };
}
