import { login } from '../controllers/authController.js';

export default async function authRoutes(fastify, options) {
  fastify.post('/login', login);
}
