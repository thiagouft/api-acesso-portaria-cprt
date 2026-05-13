import 'dotenv/config';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import portariaRoutes from './routes/portariaRoutes.js';
import pessoaRoutes from './routes/pessoaRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

// Plugins
fastify.register(cors, { origin: '*' });
fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret_cprt_token_key_2026'
});

// Arquivos estáticos (Frontend)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/',
});

// Decorator para verificar usuário (já usado nos middlewares, mas o fastify-jwt injeta no request)
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Registrar rotas
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(userRoutes, { prefix: '/api/users' });
fastify.register(portariaRoutes, { prefix: '/api/portarias' });
fastify.register(pessoaRoutes, { prefix: '/api/pessoas' });
fastify.register(syncRoutes, { prefix: '/api/sync' });

// Iniciar o servidor
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info(`Servidor rodando em http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
