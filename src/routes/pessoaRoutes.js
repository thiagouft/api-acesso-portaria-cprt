import { uploadXLS, getPessoas, autoSyncXLS, getLastSyncInfo } from '../controllers/pessoaController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

export default async function pessoaRoutes(fastify, options) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', getPessoas);
  fastify.get('/last-sync', getLastSyncInfo);
  // fastify-multipart é necessário, certifique-se que o controller use request.file() que vem desse plugin
  fastify.post('/upload', uploadXLS);
  fastify.post('/auto-sync', autoSyncXLS);
}
