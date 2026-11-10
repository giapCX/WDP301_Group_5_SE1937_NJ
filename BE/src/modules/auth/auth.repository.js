import { ObjectId } from 'mongodb';
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
function buildAccountQuery(account) {
  const trimmed = account.trim();
  const orConditions = [{
    email: {
      $regex: `^${escapeRegex(trimmed)}$`,
      $options: 'i'
    }
  }, {
    phone: trimmed
  }];
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 6) {
    const flexiblePattern = digits.split('').join('[- ]?');
    orConditions.push({
      phone: {
        $regex: flexiblePattern
      }
    });
  }
  return {
    $or: orConditions
  };
}
export function createAuthRepository(database) {
  return {
    findByAccount: account => database.collection('users').findOne(buildAccountQuery(account)),
    findById: id => database.collection('users').findOne({
      _id: new ObjectId(id)
    }),
    updatePassword: (id, passwordHash) => database.collection('users').updateOne({
      _id: id
    }, {
      $set: {
        password_hash: passwordHash,
        updated_at: new Date()
      }
    }),
    findRoleById: id => database.collection('roles').findOne({
      _id: id
    }),
    findRolesByIds: ids => database.collection('roles').find({
      _id: {
        $in: ids
      }
    }).toArray()
  };
}
