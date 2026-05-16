import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function getVeiculos(request, reply) {
  try {
    const veiculos = await prisma.veiculo.findMany();
    return reply.send(veiculos);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao buscar veículos.' });
  }
}

export async function createVeiculo(request, reply) {
  const { placa, descricao } = request.body;

  if (!placa || !descricao) {
    return reply.status(400).send({ error: 'Placa e descrição são obrigatórios.' });
  }

  try {
    const veiculoExistente = await prisma.veiculo.findUnique({
      where: { placa }
    });

    if (veiculoExistente) {
      return reply.status(400).send({ error: 'Veículo com esta placa já está cadastrado.' });
    }

    const veiculo = await prisma.veiculo.create({
      data: { placa, descricao }
    });

    await logOperacao(request.user?.id, 'CREATE_VEICULO', 'Veiculo', { placa });

    return reply.status(201).send(veiculo);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao cadastrar veículo.' });
  }
}

export async function deleteVeiculo(request, reply) {
  const { id } = request.params;

  try {
    const veiculo = await prisma.veiculo.findUnique({
      where: { id: parseInt(id) }
    });

    if (!veiculo) {
      return reply.status(404).send({ error: 'Veículo não encontrado.' });
    }

    await prisma.veiculo.delete({
      where: { id: parseInt(id) }
    });

    await logOperacao(request.user?.id, 'DELETE_VEICULO', 'Veiculo', { placa: veiculo.placa });

    return reply.send({ message: 'Veículo excluído com sucesso.' });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao excluir veículo.' });
  }
}
