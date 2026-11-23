const DEFAULT_ORIGINS = [
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
];

function corsMiddleware(req, res, next) {
  const origin = req.get('Origin');
  const configuredOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((value) => value.trim())
    : DEFAULT_ORIGINS;

  if (origin && !configuredOrigins.includes(origin)) {
    const error = new Error(`Origin ${origin} is not allowed by CORS`);
    error.status = 403;
    return next(error);
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

module.exports = corsMiddleware;
