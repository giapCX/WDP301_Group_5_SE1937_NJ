import { createAuthRepository } from '../modules/auth/auth.repository.js';
import { createAuthService } from '../modules/auth/auth.service.js';

export function createAuthMiddleware(database) {
  const service = createAuthService(createAuthRepository(database));
  return async (request, _response, next) => {
    try {
      const authenticated = await service.authenticate(request.headers.authorization);
      request.user = authenticated.user;
      request.tokenPayload = authenticated.tokenPayload;
      next();
    } catch (error) {
      next(error);
    }
  };
}
