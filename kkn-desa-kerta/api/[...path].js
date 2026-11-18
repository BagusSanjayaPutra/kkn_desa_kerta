/**
 * VERCEL CATCH-ALL SERVERLESS FUNCTION
 * Menangani semua endpoint /api/* secara dinamis
 */
const handleRequest = require('../server.js');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
