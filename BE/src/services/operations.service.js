const repository = require('../repositories/operations.repository');
module.exports = { list: (kind, query) => repository.list(kind, query), summary: (id, actor) => repository.summary(id, actor) };
