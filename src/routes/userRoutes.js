import { getUsers, createUser, deleteUser } from '../controllers/userController.js';
import { authorizeMaster } from '../middlewares/authMiddleware.js';

export default async function userRoutes(fastify, options) {
  fastify.addHook('onRequest', authorizeMaster);

  fastify.get('/', getUsers);
  fastify.post('/', createUser);
  fastify.delete('/:id', deleteUser);
}
