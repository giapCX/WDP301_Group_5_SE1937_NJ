import { getModels, modelDefinitions } from '../models/index.js';

const modelByCollection = models => new Map(
  Object.entries(modelDefinitions).map(([name, definition]) => [definition.collection, models[name]])
);

export function createRenterRepository(connection) {
  const models = getModels(connection);
  const byCollection = modelByCollection(models);
  const model = name => {
    const result = byCollection.get(name);
    if (!result) throw new Error(`No Mongoose model registered for collection "${name}".`);
    return result;
  };
  const withSession = (query, session) => session ? query.session(session) : query;

  return {
    one(name, filter, session) {
      return withSession(model(name).findOne(filter).lean(), session).exec();
    },
    list(name, filter, { session, sort = { created_at: -1 }, skip = 0, limit = 50, projection } = {}) {
      let query = model(name).find(filter).sort(sort).skip(skip).limit(limit);
      if (projection) query = query.select(projection);
      return withSession(query.lean(), session).exec();
    },
    aggregate(name, pipeline, session) {
      const query = model(name).aggregate(pipeline);
      return (session ? query.session(session) : query).exec();
    },
    count(name, filter, session) {
      return withSession(model(name).countDocuments(filter), session).exec();
    },
    async insert(name, value, session) {
      const [document] = await model(name).create([value], session ? { session } : {});
      return document.toObject();
    },
    update(name, filter, update, session) {
      return model(name).updateOne(filter, update, session ? { session, runValidators: true } : { runValidators: true }).exec();
    },
    async indexes() {
      await Promise.all([
        models.RenterChallenge.createIndexes(),
        models.RenterFile.createIndexes(),
        models.RenterFileChunk.createIndexes(),
        models.RenterContactKey.createIndexes(),
        models.DiscountCode.createIndexes(),
      ]);
    },
    async transaction(work) {
      const session = await connection.startSession();
      try {
        return await session.withTransaction(() => work(session), {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        });
      } finally {
        await session.endSession();
      }
    },
  };
}
