import { syncLeituras, getLeituras } from '../controllers/syncController.js';
import { authenticate, authorizeMaster } from '../middlewares/authMiddleware.js';

export default async function syncRoutes(fastify, options) {
  // Mobile e Master podem sincronizar, então usamos apenas authenticate
  fastify.post('/', { preHandler: authenticate }, syncLeituras);
  
  // Apenas Master pode ver o relatório de leituras
  fastify.get('/', { preHandler: authorizeMaster }, getLeituras);
}
