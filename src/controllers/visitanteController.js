import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function getVisitantes(request, reply) {
  const { incluirInativos } = request.query || {};
  const whereClause = incluirInativos === 'true' ? { deleted: false } : { ativo: true, deleted: false };

  try {
    const visitantes = await prisma.visitante.findMany({
      where: whereClause,
      orderBy: { data_cadastro: 'desc' }
    });
    return reply.send(visitantes);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao buscar visitantes.' });
  }
}

export async function createVisitante(request, reply) {
  const { cpf, nome, empresa, credenciais, situacao, observacao, data_inicio, data_fim } = request.body || {};

  if (!cpf || !nome) {
    return reply.status(400).send({ error: 'CPF e Nome são obrigatórios.' });
  }

  const cpfClean = cpf.toString().trim();

  try {
    const visitanteExistente = await prisma.visitante.findUnique({
      where: { cpf: cpfClean }
    });

    if (visitanteExistente) {
      if (!visitanteExistente.deleted) {
        return reply.status(400).send({ error: 'Já existe um visitante cadastrado com este CPF.' });
      }

      // Restaura o visitante excluído logicamente com novos dados
      const visitante = await prisma.visitante.update({
        where: { id: visitanteExistente.id },
        data: {
          nome: nome.toString().trim(),
          empresa: empresa ? empresa.toString().trim() : null,
          credenciais: credenciais ? credenciais.toString().trim() : null,
          situacao: situacao !== undefined ? parseInt(situacao) : 1,
          observacao: observacao ? observacao.toString().trim() : null,
          ativo: true,
          deleted: false,
          data_inicio: data_inicio ? new Date(data_inicio + 'T00:00:00') : null,
          data_fim: data_fim ? new Date(data_fim + 'T23:59:59') : null,
          data_cadastro: new Date()
        }
      });

      await logOperacao(request.user?.id, 'CRIAR_VISITANTE', 'Visitante', { cpf: visitante.cpf, nome: visitante.nome, restaurado: true });

      return reply.status(201).send(visitante);
    }

    const visitante = await prisma.visitante.create({
      data: {
        cpf: cpfClean,
        nome: nome.toString().trim(),
        empresa: empresa ? empresa.toString().trim() : null,
        credenciais: credenciais ? credenciais.toString().trim() : null,
        situacao: situacao !== undefined ? parseInt(situacao) : 1,
        observacao: observacao ? observacao.toString().trim() : null,
        ativo: true,
        deleted: false,
        data_inicio: data_inicio ? new Date(data_inicio + 'T00:00:00') : null,
        data_fim: data_fim ? new Date(data_fim + 'T23:59:59') : null
      }
    });

    await logOperacao(request.user?.id, 'CRIAR_VISITANTE', 'Visitante', { cpf: visitante.cpf, nome: visitante.nome });

    return reply.status(201).send(visitante);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao criar visitante.' });
  }
}

export async function updateVisitante(request, reply) {
  const { id } = request.params;
  const { cpf, nome, empresa, credenciais, situacao, observacao, ativo, data_inicio, data_fim } = request.body || {};

  try {
    const visitanteId = parseInt(id);
    const existing = await prisma.visitante.findUnique({ where: { id: visitanteId } });

    if (!existing) {
      return reply.status(404).send({ error: 'Visitante não encontrado.' });
    }

    const dataToUpdate = {};
    if (cpf !== undefined) dataToUpdate.cpf = cpf.toString().trim();
    if (nome !== undefined) dataToUpdate.nome = nome.toString().trim();
    if (empresa !== undefined) dataToUpdate.empresa = empresa ? empresa.toString().trim() : null;
    if (credenciais !== undefined) dataToUpdate.credenciais = credenciais ? credenciais.toString().trim() : null;
    if (situacao !== undefined) dataToUpdate.situacao = parseInt(situacao);
    if (observacao !== undefined) dataToUpdate.observacao = observacao ? observacao.toString().trim() : null;
    if (ativo !== undefined) dataToUpdate.ativo = Boolean(ativo);
    if (data_inicio !== undefined) dataToUpdate.data_inicio = data_inicio ? new Date(data_inicio + 'T00:00:00') : null;
    if (data_fim !== undefined) dataToUpdate.data_fim = data_fim ? new Date(data_fim + 'T23:59:59') : null;

    const visitante = await prisma.visitante.update({
      where: { id: visitanteId },
      data: dataToUpdate
    });

    await logOperacao(request.user?.id, 'ATUALIZAR_VISITANTE', 'Visitante', { id: visitante.id, cpf: visitante.cpf });

    return reply.send(visitante);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao atualizar visitante.' });
  }
}

export async function toggleVisitanteStatus(request, reply) {
  const { id } = request.params;

  try {
    const visitanteId = parseInt(id);
    const existing = await prisma.visitante.findUnique({ where: { id: visitanteId } });

    if (!existing) {
      return reply.status(404).send({ error: 'Visitante não encontrado.' });
    }

    const visitante = await prisma.visitante.update({
      where: { id: visitanteId },
      data: { ativo: !existing.ativo }
    });

    await logOperacao(request.user?.id, 'TOGGLE_STATUS_VISITANTE', 'Visitante', { id: visitante.id, novoStatusAtivo: visitante.ativo });

    return reply.send(visitante);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao alterar status do visitante.' });
  }
}

export async function deleteVisitante(request, reply) {
  const { id } = request.params;

  try {
    const visitanteId = parseInt(id);
    await prisma.visitante.update({
      where: { id: visitanteId },
      data: {
        deleted: true,
        ativo: false
      }
    });

    await logOperacao(request.user?.id, 'DELETAR_VISITANTE', 'Visitante', { id: visitanteId });

    return reply.send({ message: 'Visitante removido com sucesso.' });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao deletar visitante.' });
  }
}
