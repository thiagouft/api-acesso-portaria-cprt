import { syncLeituras, getLeituras, syncLeiturasVeiculo, getLeiturasVeiculo } from '../controllers/syncController.js';
import { authenticate, authorizeMaster } from '../middlewares/authMiddleware.js';

export default async function syncRoutes(fastify, options) {
  // Mobile e Master podem sincronizar, então usamos apenas authenticate
  fastify.post('/', { preHandler: authenticate }, syncLeituras);
  
  // Apenas Master pode ver o relatório de leituras
  fastify.get('/', { preHandler: authorizeMaster }, getLeituras);

  // Leituras Veiculo
  fastify.post('/leituras-veiculo', { preHandler: authenticate }, syncLeiturasVeiculo);
  fastify.get('/leituras-veiculo', { preHandler: authorizeMaster }, getLeiturasVeiculo);
}
