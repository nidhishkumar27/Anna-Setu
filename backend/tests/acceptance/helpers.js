const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');

const TEST_PASSWORD = 'acceptance-password-123';

function uniqueEmail(label) {
  return `${label}-${randomUUID()}@example.test`;
}

function registerAccount({ role, name, donorType, email = uniqueEmail(role) }) {
  return request(app).post('/api/auth/register').send({
    name: name || `Acceptance ${role}`,
    email,
    password: TEST_PASSWORD,
    role,
    ...(donorType ? { donorType } : {}),
  });
}

function login(email, password = TEST_PASSWORD) {
  return request(app).post('/api/auth/login').send({ email, password });
}

async function createAdmin() {
  const email = uniqueEmail('admin');
  const user = await User.create({
    name: 'Acceptance Admin',
    email,
    password: TEST_PASSWORD,
    role: 'admin',
    status: 'approved',
  });
  const response = await login(email);
  return { user, email, token: response.body.token, loginResponse: response };
}

module.exports = { TEST_PASSWORD, uniqueEmail, registerAccount, login, createAdmin };
