import { uploadAPK, downloadAPK, getAPKInfo } from '../controllers/apkController.js';
import { authorizeMaster } from '../middlewares/authMiddleware.js';

export default async function apkRoutes(fastify, options) {
  // Rota protegida: apenas usuários MASTER podem subir um novo APK
  fastify.post('/upload', { preHandler: authorizeMaster }, uploadAPK);

  // Rotas públicas: qualquer um pode obter info ou baixar o APK
  fastify.get('/download', downloadAPK);
  fastify.get('/info', getAPKInfo);
}
