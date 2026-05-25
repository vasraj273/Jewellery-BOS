export function errorHandler(err, _req, res, _next) {
  console.error('[JBOS] Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
}
