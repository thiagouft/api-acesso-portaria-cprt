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
  const { dataInicial, dataFinal, matricula, nome } = request.query;

  // 1. Fetch all Pessoas for memory mapping
  const todasPessoas = await prisma.pessoa.findMany();
  const pessoaMap = {}; 
  
  for (const p of todasPessoas) {
    if (p.credenciais) {
      const creds = p.credenciais.split(',').map(c => c.trim());
      for (const c of creds) {
        pessoaMap[c] = { matricula: p.matricula, nome: p.nome };
      }
    }
  }

  // 2. Determine credentials to filter if matricula or nome is provided
  let credenciaisFiltro = null;
  if (matricula || nome) {
    credenciaisFiltro = [];
    const removeAcentos = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matQuery = matricula ? matricula.toLowerCase().trim() : null;
    const nomeQuery = nome ? removeAcentos(nome.toLowerCase().trim()) : null;

    for (const p of todasPessoas) {
      let match = true;
      if (matQuery && p.matricula.toLowerCase() !== matQuery) match = false;
      
      if (nomeQuery) {
        if (!p.nome) {
          match = false;
        } else {
          const nomePessoa = removeAcentos(p.nome.toLowerCase());
          if (!nomePessoa.includes(nomeQuery)) match = false;
        }
      }
      
      if (match && p.credenciais) {
        const creds = p.credenciais.split(',').map(c => c.trim());
        credenciaisFiltro.push(...creds);
      }
    }

    if (credenciaisFiltro.length === 0) {
      return reply.send([]);
    }
  }

  // 3. Build LeituraRFID query
  const where = {};
  if (credenciaisFiltro) {
    where.credencial = { in: credenciaisFiltro };
  }
  
  if (dataInicial || dataFinal) {
    where.data_hora_leitura = {};
    if (dataInicial) {
      where.data_hora_leitura.gte = new Date(dataInicial + 'T00:00:00');
    }
    if (dataFinal) {
      where.data_hora_leitura.lte = new Date(dataFinal + 'T23:59:59');
    }
  }

  const leituras = await prisma.leituraRFID.findMany({
    where,
    include: {
      portaria: true
    },
    orderBy: {
      data_hora_leitura: 'desc'
    },
    take: 2000
  });

  // 4. Map Pessoas to Leituras
  const resultado = leituras.map(l => {
    const pessoaInfo = pessoaMap[l.credencial] || { matricula: '-', nome: 'N/A' };
    return {
      ...l,
      pessoa_matricula: pessoaInfo.matricula,
      pessoa_nome: pessoaInfo.nome
    };
  });

  return reply.send(resultado);
}
