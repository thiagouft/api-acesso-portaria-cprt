import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

const TIMEZONE = 'America/Sao_Paulo';

function parseLocalToUtc(dateStr, timeStr) {
  const utcDate = new Date(`${dateStr}T${timeStr}Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(utcDate);
  const partsMap = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      partsMap[part.type] = parseInt(part.value, 10);
    }
  }
  const targetDate = Date.UTC(
    partsMap.year,
    partsMap.month - 1,
    partsMap.day,
    partsMap.hour,
    partsMap.minute,
    partsMap.second
  );
  const diff = utcDate.getTime() - targetDate;
  return new Date(utcDate.getTime() + diff);
}

function getLocalTimeStr(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(date);
  const hh = String(parts.find(p => p.type === 'hour').value).padStart(2, '0');
  const mm = String(parts.find(p => p.type === 'minute').value).padStart(2, '0');
  return `${hh}:${mm}`;
}

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
  const { dataInicial, dataFinal, matricula, nome, horaInicial, horaFinal } = request.query;

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
      where.data_hora_leitura.gte = parseLocalToUtc(dataInicial, '00:00:00');
    }
    if (dataFinal) {
      where.data_hora_leitura.lte = parseLocalToUtc(dataFinal, '23:59:59');
    }
  }

  const hasFilter = Boolean(dataInicial || dataFinal || matricula || nome || horaInicial || horaFinal);

  const queryOptions = {
    where,
    include: {
      portaria: true
    },
    orderBy: {
      data_hora_leitura: 'desc'
    }
  };

  if (!hasFilter) {
    queryOptions.take = 2000;
  }

  const leituras = await prisma.leituraRFID.findMany(queryOptions);

  // 4. Map Pessoas to Leituras
  let resultado = leituras.map(l => {
    const pessoaInfo = pessoaMap[l.credencial] || { matricula: '-', nome: 'N/A' };
    return {
      ...l,
      pessoa_matricula: pessoaInfo.matricula,
      pessoa_nome: pessoaInfo.nome
    };
  });

  // 5. Filter by hour interval in format hh:mm (in local timezone)
  if (horaInicial || horaFinal) {
    resultado = resultado.filter(l => {
      const timeStr = getLocalTimeStr(l.data_hora_leitura);
      
      if (horaInicial && timeStr < horaInicial) return false;
      if (horaFinal && timeStr > horaFinal) return false;
      return true;
    });
  }

  return reply.send(resultado);
}

export async function syncLeiturasVeiculo(request, reply) {
  const { leituras } = request.body;

  if (!Array.isArray(leituras) || leituras.length === 0) {
    return reply.status(400).send({ error: 'Nenhum dado de leitura de veículo fornecido ou formato inválido.' });
  }

  let count = 0;

  try {
    for (const leitura of leituras) {
      // leitura = { id, placa, matricula_condutor, nome_condutor, credencial_condutor, data_hora_leitura, id_celular, situacao }
      
      await prisma.leituraVeiculo.create({
        data: {
          id: leitura.id,
          placa: leitura.placa,
          matricula_condutor: leitura.matricula_condutor,
          nome_condutor: leitura.nome_condutor,
          credencial_condutor: leitura.credencial_condutor,
          data_hora_leitura: new Date(leitura.data_hora_leitura),
          data_hora_sincronizacao: new Date(),
          id_celular: leitura.id_celular,
          situacao: parseInt(leitura.situacao),
          id_portaria: leitura.id_portaria ? parseInt(leitura.id_portaria) : null,
          sentido: leitura.sentido || null,
          is_condutor: leitura.is_condutor !== undefined ? (leitura.is_condutor === true || leitura.is_condutor === 'true' || leitura.is_condutor === 1 || leitura.is_condutor === '1') : true
        }
      });
      count++;
    }

    await logOperacao(request.user.id, 'SYNC_MOBILE_VEICULO', 'LeituraVeiculo', { registros_sincronizados: count, id_celular: leituras[0]?.id_celular });

    return reply.status(200).send({ message: `${count} leituras de veículo sincronizadas com sucesso.`, count });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao sincronizar leituras de veículos.' });
  }
}

export async function getLeiturasVeiculo(request, reply) {
  const { dataInicial, dataFinal, placa, matricula, nome, horaInicial, horaFinal } = request.query;

  const where = {};
  
  if (placa) {
    where.placa = {
      contains: placa
    };
  }

  if (matricula) {
    where.matricula_condutor = {
      contains: matricula
    };
  }

  if (nome) {
    where.nome_condutor = {
      contains: nome
    };
  }
  
  if (dataInicial || dataFinal) {
    where.data_hora_leitura = {};
    if (dataInicial) {
      where.data_hora_leitura.gte = parseLocalToUtc(dataInicial, '00:00:00');
    }
    if (dataFinal) {
      where.data_hora_leitura.lte = parseLocalToUtc(dataFinal, '23:59:59');
    }
  }

  const hasFilter = Boolean(dataInicial || dataFinal || placa || matricula || nome || horaInicial || horaFinal);

  try {
    const queryOptions = {
      where,
      include: {
        portaria: { select: { descricao: true } }
      },
      orderBy: {
        data_hora_leitura: 'desc'
      }
    };

    if (!hasFilter) {
      queryOptions.take = 2000;
    }

    const leituras = await prisma.leituraVeiculo.findMany(queryOptions);

    if (leituras.length === 0) {
      return reply.send([]);
    }

    // Buscar descrições dos veículos cadastrados para relacionar com a placa
    const veiculos = await prisma.veiculo.findMany({
      select: {
        placa: true,
        descricao: true
      }
    });

    const veiculoMap = new Map(
      veiculos.map(v => [v.placa.trim().toLowerCase(), v.descricao])
    );

    let resultado = leituras.map(l => ({
      ...l,
      portaria: l.portaria ? l.portaria.descricao : 'Desconhecida',
      sentido: l.sentido || '-',
      descricao_veiculo: veiculoMap.get(l.placa.trim().toLowerCase()) || '-'
    }));

    // Filter by hour interval in format hh:mm (in local timezone)
    if (horaInicial || horaFinal) {
      resultado = resultado.filter(l => {
        const timeStr = getLocalTimeStr(l.data_hora_leitura);
        
        if (horaInicial && timeStr < horaInicial) return false;
        if (horaFinal && timeStr > horaFinal) return false;
        return true;
      });
    }

    return reply.send(resultado);
  } catch(e) {
    console.error(e);
    return reply.status(500).send({ error: 'Erro ao buscar leituras de veículos.' });
  }
}
