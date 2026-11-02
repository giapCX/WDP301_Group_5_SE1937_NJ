export function notFound(_request, response) {
  response.status(404).json({
    error: {
      message: 'API route not found.'
    }
  });
}
export function errorHandler(error, _request, response, _next) {
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  response.status(status).json({
    error: {
      message: status === 500 ? 'Internal server error.' : error.message
    }
  });
}
