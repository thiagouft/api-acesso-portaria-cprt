import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function getPortarias(request, reply) {
  const portarias = await prisma.portaria.findMany();
  return reply.send(portarias);
}

export async function createPortaria(request, reply) {
  const { descricao } = request.body;
  try {
    const novaPortaria = await prisma.portaria.create({
      data: { descricao }
    });
    await logOperacao(request.user?.id, 'CREATE', 'Portaria', { descricao });
    return reply.status(201).send(novaPortaria);
  } catch (error) {
    return reply.status(400).send({ error: 'Erro ao criar portaria.' });
  }
}

export async function deletePortaria(request, reply) {
  const { id } = request.params;
  try {
    await prisma.portaria.delete({ where: { id: parseInt(id) } });
    await logOperacao(request.user?.id, 'DELETE', 'Portaria', { id });
    return reply.status(204).send();
  } catch (error) {
    return reply.status(400).send({ error: 'Erro ao deletar portaria.' });
  }
}
