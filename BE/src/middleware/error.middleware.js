import mongoose from 'mongoose';

export function notFound(_request, response) {
  response.status(404).json({
    error: {
      message: 'API route not found.'
    }
  });
}
export function errorHandler(error, _request, response, _next) {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError || error instanceof mongoose.Error.StrictModeError) {
    return response.status(400).json({ error: { message: 'Dữ liệu không hợp lệ.' } });
  }
  if (error.code === 11000) {
    return response.status(409).json({ error: { message: 'Dữ liệu đã tồn tại.' } });
  }
  const status = error.status >= 400 && (error.status < 500 || (error.expose && error.status === 503))
    ? error.status : 500;
  const exposed = status !== 500;
  if (!exposed) console.error(error);
  response.status(status).json({
    error: {
      message: exposed ? error.message : 'Internal server error.',
      ...(exposed && error.expose && error.details ? { details: error.details } : {}),
    }
  });
}
