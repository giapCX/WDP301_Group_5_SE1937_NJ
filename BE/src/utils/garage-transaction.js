import { httpError } from './http-error.js';

export async function garageTransaction(repository, work) {
  const hello = await repository.command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw httpError(503, 'Thao tác này cần MongoDB replica set hoặc Atlas để lưu dữ liệu đồng bộ.');
  }
  const session = await repository.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary',
    });
  } finally {
    await session.endSession();
  }
}
