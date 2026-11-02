export function createManagerRepository(database) {
  return {
    collection: (name) => database.collection(name),
  };
}
