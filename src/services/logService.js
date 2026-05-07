import prisma from '../prisma.js';

export async function logOperacao(id_usuario, acao, entidade, detalhes) {
  try {
    await prisma.logOperacao.create({
      data: {
        id_usuario: id_usuario || null,
        acao,
        entidade,
        detalhes: JSON.stringify(detalhes)
      }
    });
  } catch (error) {
    console.error('Erro ao salvar log de operação:', error);
  }
}
