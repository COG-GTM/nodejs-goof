// Hardened express-fileupload settings for the todo import endpoint.
module.exports = {
  limits: { fileSize: 2 * 1024 }, // 2 MB max import
  abortOnLimit: true,
  responseOnLimit: 'Import file is too large.',
  safeFileNames: true,
  preserveExtension: true,
};
