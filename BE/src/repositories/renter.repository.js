// Shared MongoDB collections keep renter, manager and garage data consistent.
export function createRenterRepository(connection) {
  const c = name => connection.db.collection(name);
  return {
    one: (name, filter, session) => c(name).findOne(filter, {
      session
    }),
    list: (name, filter, {
      session,
      sort = {
        created_at: -1
      },
      skip = 0,
      limit = 50,
      projection
    } = {}) => c(name).find(filter, {
      session,
      projection
    }).sort(sort).skip(skip).limit(limit).toArray(),
    aggregate: (name, pipeline) => c(name).aggregate(pipeline).toArray(),
    count: (name, filter) => c(name).countDocuments(filter),
    insert: async (name, doc, session) => {
      await c(name).insertOne(doc, {
        session
      });
      return doc;
    },
    update: (name, filter, update, session) => c(name).updateOne(filter, update, {
      session
    }),
    async indexes() {
      await c('renter_challenges').createIndex({
        expires_at: 1
      }, {
        expireAfterSeconds: 0
      });
      await c('renter_files').createIndex({
        owner_id: 1,
        created_at: -1
      });
      await c('bookings').createIndex({
        renter_id: 1,
        request_key: 1
      }, {
        unique: true,
        partialFilterExpression: {
          request_key: {
            $type: 'string'
          }
        }
      });
      await c('payment_transactions').createIndex({
        idempotency_key: 1
      }, {
        unique: true
      });
    },
    async transaction(work) {
      const session = await connection.startSession();
      try {
        return await session.withTransaction(() => work(session), {
          readConcern: {
            level: 'snapshot'
          },
          writeConcern: {
            w: 'majority'
          },
          readPreference: 'primary'
        });
      } finally {
        await session.endSession();
      }
    }
  };
}
