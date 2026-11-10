export function createOperationRepository(database) {
  const collection = (name) => database.collection(name);
  return {
    collection,
    findMany: (name, filter, { page, limit, sortBy }) =>
      collection(name).find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit).toArray(),
    count: (name, filter) => collection(name).countDocuments(filter),
    findById: (name, id) => collection(name).findOne({ _id: id }),
    updateOne: (name, filter, update) => collection(name).updateOne(filter, update),
    insertOne: (name, document) => collection(name).insertOne(document),
  };
}
