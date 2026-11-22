function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = Number(error.status || error.statusCode) || 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message || 'Internal server error';

  if (status >= 500) console.error(error);
  return res.status(status).json({
    success: false,
    message,
  });
}

module.exports = errorMiddleware;
