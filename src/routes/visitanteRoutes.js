import {
  getVisitantes,
  createVisitante,
  updateVisitante,
  toggleVisitanteStatus,
  deleteVisitante
} from '../controllers/visitanteController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

export default async function visitanteRoutes(fastify, options) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', getVisitantes);
  fastify.post('/', createVisitante);
  fastify.put('/:id', updateVisitante);
  fastify.patch('/:id/status', toggleVisitanteStatus);
  fastify.delete('/:id', deleteVisitante);
}
