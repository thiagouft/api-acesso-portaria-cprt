import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function syncLeituras(request, reply) {
  const { leituras } = request.body;

  if (!Array.isArray(leituras) || leituras.length === 0) {
    return reply.status(400).send({ error: 'Nenhum dado de leitura fornecido ou formato inválido.' });
  }

  let count = 0;

  try {
    for (const leitura of leituras) {
      // leitura = { credencial, id_portaria, data_hora_leitura, id_celular, situacao }
      
      await prisma.leituraRFID.create({
        data: {
          credencial: leitura.credencial,
          id_portaria: parseInt(leitura.id_portaria),
          data_hora_leitura: new Date(leitura.data_hora_leitura),
          data_hora_sincronizacao: new Date(),
          id_celular: leitura.id_celular,
          situacao: parseInt(leitura.situacao)
        }
      });
      count++;
    }

    // Log the synchronization event, including the user who did it (the mobile agent)
    await logOperacao(request.user.id, 'SYNC_MOBILE', 'LeituraRFID', { registros_sincronizados: count, id_celular: leituras[0]?.id_celular });

    return reply.status(200).send({ message: `${count} leituras sincronizadas com sucesso.`, count });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao sincronizar leituras.' });
  }
}

export async function getLeituras(request, reply) {
  // Apenas MASTER deveria ver o relatório
  const leituras = await prisma.leituraRFID.findMany({
    include: {
      portaria: true
    },
    orderBy: {
      data_hora_leitura: 'desc'
    }
  });
  return reply.send(leituras);
}
