export function notFound(_request, response) {
  response.status(404).json({
    error: {
      message: 'API route not found.'
    }
  });
}
export function errorHandler(error, _request, response, _next) {
  const requestedStatus = Number(error.status);
  const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
    ? requestedStatus
    : 500;
  if (status >= 500) console.error(error);
  response.status(status).json({
    error: {
      message: status >= 500 && error.expose !== true ? 'Internal server error.' : error.message,
      ...(error.expose === true && error.details !== undefined
        ? { details: error.details }
        : {}),
    }
  });
}
