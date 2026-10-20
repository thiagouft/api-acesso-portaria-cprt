import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function getRefeitorios(request, reply) {
  try {
    const refeitorios = await prisma.refeitorio.findMany({
      orderBy: { id: 'asc' }
    });
    return reply.send(refeitorios);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao buscar refeitórios.' });
  }
}

export async function createRefeitorio(request, reply) {
  const { descricao } = request.body;

  if (!descricao || !descricao.trim()) {
    return reply.status(400).send({ error: 'A descrição do refeitório é obrigatória.' });
  }

  try {
    const novoRefeitorio = await prisma.refeitorio.create({
      data: {
        descricao: descricao.trim(),
        ativo: true
      }
    });

    await logOperacao(request.user?.id, 'CREATE', 'Refeitorio', { id: novoRefeitorio.id, descricao: novoRefeitorio.descricao });

    return reply.status(201).send(novoRefeitorio);
  } catch (error) {
    console.error(error);
    return reply.status(400).send({ error: 'Erro ao criar refeitório.' });
  }
}

export async function updateRefeitorio(request, reply) {
  const { id } = request.params;
  const { descricao, ativo } = request.body;

  try {
    const data = {};
    if (descricao !== undefined) data.descricao = descricao.trim();
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const refeitorioAtualizado = await prisma.refeitorio.update({
      where: { id: parseInt(id) },
      data
    });

    await logOperacao(request.user?.id, 'UPDATE', 'Refeitorio', { id, ...data });

    return reply.send(refeitorioAtualizado);
  } catch (error) {
    console.error(error);
    return reply.status(400).send({ error: 'Erro ao atualizar refeitório.' });
  }
}

export async function deleteRefeitorio(request, reply) {
  const { id } = request.params;
  const idNum = parseInt(id);

  try {
    // Verificar se já possui leituras associadas
    const countLeituras = await prisma.leituraRefeicao.count({
      where: { id_refeitorio: idNum }
    });

    if (countLeituras > 0) {
      // Se possui leituras, inativamos para manter integridade histórica
      await prisma.refeitorio.update({
        where: { id: idNum },
        data: { ativo: false }
      });

      await logOperacao(request.user?.id, 'DEACTIVATE', 'Refeitorio', { id: idNum, motivo: 'Possui leituras associadas' });
      return reply.send({ message: 'Refeitório inativado pois possui histórico de leituras registradas.' });
    }

    await prisma.refeitorio.delete({
      where: { id: idNum }
    });

    await logOperacao(request.user?.id, 'DELETE', 'Refeitorio', { id: idNum });

    return reply.status(204).send();
  } catch (error) {
    console.error(error);
    return reply.status(400).send({ error: 'Erro ao remover refeitório.' });
  }
}
