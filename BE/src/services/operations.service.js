const repository = require('../repositories/operations.repository');
module.exports = {
  list: (kind, query, actor) => repository.list(kind, query, undefined, actor?.role_name === 'manager'),
  summary: (id, actor) => repository.summary(id, actor),
};
