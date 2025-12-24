const express = require('express');

const { login, me, register } = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', requireAuth, me);

module.exports = { authRouter };

