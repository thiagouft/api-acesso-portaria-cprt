import { getPortarias, createPortaria, deletePortaria } from '../controllers/portariaController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

export default async function portariaRoutes(fastify, options) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', getPortarias);
  fastify.post('/', createPortaria);
  fastify.delete('/:id', deletePortaria);
}
