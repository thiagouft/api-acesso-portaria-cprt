import { getVeiculos, createVeiculo, deleteVeiculo } from '../controllers/veiculoController.js';

export default async function veiculoRoutes(fastify, options) {
  fastify.get('/', { onRequest: [fastify.authenticate] }, getVeiculos);
  fastify.post('/', { onRequest: [fastify.authenticate] }, createVeiculo);
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, deleteVeiculo);
}
