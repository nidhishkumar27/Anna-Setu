function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function runPreSaveMiddleware(Model, document) {
  return new Promise((resolve, reject) => {
    Model.schema.s.hooks.execPre('save', document, [], error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

module.exports = { createResponse, runPreSaveMiddleware };
