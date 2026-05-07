import xlsx from 'xlsx';
import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function uploadXLS(request, reply) {
  const data = await request.file();
  
  if (!data) {
    return reply.status(400).send({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const buffer = await data.toBuffer();
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Ler a partir da linha 11 (índice 10 no header do xlsx, onde o array começa em 0)
    // O range do xlsx pode ser ajustado, ou podemos pegar os dados formatados
    // Pular as primeiras 10 linhas. Range começa do 11 (header) -> dados começam na linha 12
    const rows = xlsx.utils.sheet_to_json(sheet, { range: 10, raw: false });

    let countUpsert = 0;

    for (const row of rows) {
      // Normalizar chaves para facilitar a busca, caso tenham espaços
      const normalizeKey = (key) => key.trim().toLowerCase();
      const keys = Object.keys(row);
      
      let matricula, nome, situacaoStr, credenciais, observacao;

      for (const key of keys) {
        const normKey = normalizeKey(key);
        if (normKey.includes('matrícula') || normKey.includes('matricula')) matricula = row[key];
        else if (normKey.includes('nome')) nome = row[key];
        else if (normKey.includes('situação') || normKey.includes('situacao')) situacaoStr = row[key];
        else if (normKey.includes('credencial') || normKey.includes('credenciais')) credenciais = row[key];
        else if (normKey.includes('observação') || normKey.includes('observacao')) observacao = row[key];
      }

      if (!matricula) continue; // Pular se não tiver matrícula

      let situacaoInt = 0;
      if (situacaoStr) {
        const strLower = situacaoStr.toLowerCase();
        if (strLower.includes('permitido')) {
          situacaoInt = 1;
        } else if (strLower.includes('bloqueado')) {
          situacaoInt = 0;
        }
      }

      await prisma.pessoa.upsert({
        where: { matricula: matricula.toString() },
        update: {
          nome: nome ? nome.toString() : '',
          credenciais: credenciais ? credenciais.toString() : null,
          situacao: situacaoInt,
          observacao: observacao ? observacao.toString() : null,
          data_ultima_sincronizacao: new Date()
        },
        create: {
          matricula: matricula.toString(),
          nome: nome ? nome.toString() : '',
          credenciais: credenciais ? credenciais.toString() : null,
          situacao: situacaoInt,
          observacao: observacao ? observacao.toString() : null,
          data_ultima_sincronizacao: new Date()
        }
      });
      countUpsert++;
    }

    await logOperacao(request.user?.id, 'UPLOAD_XLS', 'Pessoa', { registros_afetados: countUpsert });

    return reply.send({ message: `Arquivo processado com sucesso. ${countUpsert} registros atualizados/criados.` });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao processar o arquivo XLS.' });
  }
}

export async function getPessoas(request, reply) {
  const pessoas = await prisma.pessoa.findMany();
  return reply.send(pessoas);
}
