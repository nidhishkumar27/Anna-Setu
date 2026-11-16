// app.js — Express app without server.listen(), used by tests and server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// --- Routes ---
app.get('/', (req, res) => res.json({ message: 'Welcome to the Anna Setu API!' }));
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/donor',     require('./routes/donor'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/volunteer', require('./routes/volunteer'));
app.use('/api/receiver',  require('./routes/receiver'));
app.use('/api/compost',   require('./routes/compost'));
app.use('/api/users',     require('./routes/user'));

module.exports = app;
