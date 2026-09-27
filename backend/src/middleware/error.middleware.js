// Never expose database errors, request contents, or stack traces to clients.
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  const message = status === 400 ? 'Invalid request body'
    : status === 413 ? 'Request body too large'
      : status < 500 ? 'Invalid request' : 'Internal server error';
  res.status(status).json({ success: false, message });
}

module.exports = errorHandler;
