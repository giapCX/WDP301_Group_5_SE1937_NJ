import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../service/auth.service.js';
export function createAuthMiddleware(database) {
  const service = createAuthService(createAuthRepository(database));
  return async (request, _response, next) => {
    try {
      Object.assign(request, await service.authenticate(request.headers.authorization));
      next();
    } catch (error) {
      next(error);
    }
  };
}
