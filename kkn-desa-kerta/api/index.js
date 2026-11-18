/**
 * VERCEL SERVERLESS FUNCTION HANDLER
 * Mengarahkan seluruh request API Vercel ke handler server Jelajah Desa Kerta
 */
const handleRequest = require('../server.js');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
