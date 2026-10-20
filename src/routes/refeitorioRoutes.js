import { getRefeitorios, createRefeitorio, updateRefeitorio, deleteRefeitorio } from '../controllers/refeitorioController.js';
import { authenticate, authorizeMaster } from '../middlewares/authMiddleware.js';

export default async function refeitorioRoutes(fastify, options) {
  // Leitura acessível a qualquer usuário autenticado (MASTER, REFEICAO, REFEICAO_MULTI)
  fastify.get('/', { preHandler: authenticate }, getRefeitorios);

  // Modificações apenas MASTER
  fastify.post('/', { preHandler: authorizeMaster }, createRefeitorio);
  fastify.put('/:id', { preHandler: authorizeMaster }, updateRefeitorio);
  fastify.delete('/:id', { preHandler: authorizeMaster }, deleteRefeitorio);
}
