export function createVehicleInspectionRepository(database) {
  return {
    collection: (name) => database.collection(name),
    command: (command) => database.command(command),
    startSession: () => database.client.startSession(),
  };
}
