import xlsx from 'xlsx';
import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

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

export async function autoSyncXLS(request, reply) {
  try {
    const countUpsert = await runAutoSyncProgrammatically();
    await logOperacao(request.user?.id, 'AUTO_SYNC_XLS', 'Pessoa', { registros_afetados: countUpsert });
    return reply.send({ message: `Sincronização concluída com sucesso. ${countUpsert} registros atualizados/criados.` });
  } catch (error) {
    return reply.status(500).send({ error: 'Erro ao executar a sincronização automática: ' + error.message });
  }
}

export async function getLastSyncInfo(request, reply) {
  try {
    const lastPessoa = await prisma.pessoa.findFirst({
      orderBy: { data_ultima_sincronizacao: 'desc' },
      select: { data_ultima_sincronizacao: true }
    });

    if (!lastPessoa) {
      return reply.send({ lastSync: null });
    }

    return reply.send({ lastSync: lastPessoa.data_ultima_sincronizacao });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Erro ao obter informações de sincronização.' });
  }
}

export async function runAutoSyncProgrammatically() {
  const downloadPath = path.resolve('./temp_downloads');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  // Helper: wait for a new file to appear
  const waitForDownload = (directory, timeout = 60000) => {
    return new Promise((resolve) => {
      const extensions = ['.xls', '.xlsx', '.csv'];
      const before = new Set(fs.readdirSync(directory));

      const interval = setInterval(() => {
        const after = fs.readdirSync(directory);
        const newFiles = after.filter(
          (f) =>
            !before.has(f) &&
            extensions.some((ext) => f.toLowerCase().endsWith(ext)) &&
            !f.endsWith('.crdownload')
        );

        if (newFiles.length > 0) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(path.join(directory, newFiles[0]));
        }
      }, 500);

      const timer = setTimeout(() => {
        clearInterval(interval);
        resolve(null);
      }, timeout);
    });
  };

  let browser;
  try {
    console.log('[AUTO-SYNC] Iniciando sincronização programada...');
    browser = await puppeteer.launch({
      headless: true, // headless para rodar em background no servidor
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
    });

    console.log('[AUTO-SYNC] Acessando página de login...');
    await page.goto('https://ponteriotocantins.dimep-ams.com.br/logon.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('[AUTO-SYNC] Preenchendo usuário...');
    await page.waitForSelector('#txtUsrLogin', { visible: true });
    await page.click('#txtUsrLogin');
    await page.type('#txtUsrLogin', 'mixestec', { delay: 50 });

    console.log('[AUTO-SYNC] Preenchendo senha...');
    await page.waitForSelector('#txtUserPassLogin', { visible: true });
    await page.click('#txtUserPassLogin');
    await page.type('#txtUserPassLogin', 'Mixestec@123', { delay: 50 });

    console.log('[AUTO-SYNC] Clicando em Entrar...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('#Submit1'),
    ]);

    console.log('[AUTO-SYNC] Navegando para a página do relatório...');
    await page.goto(
      'https://ponteriotocantins.dimep-ams.com.br/Reports/ProcessPluginReport.aspx?idPlugin=27',
      { waitUntil: 'networkidle2', timeout: 30000 }
    );

    console.log('[AUTO-SYNC] Selecionando formato Excel...');
    const selectSelector = '#MainContentMainMaster_MainContent_ctl00_ddlGenerateType';
    await page.waitForSelector(selectSelector, { visible: true });
    await page.select(selectSelector, '4'); // Excel

    console.log('[AUTO-SYNC] Clicando em Gerar...');
    const btnSelector = '#MainContentMainMaster_MainContent_ctl00_btnGenerate';
    await page.waitForSelector(btnSelector, { visible: true });
    await page.click(btnSelector);

    console.log('[AUTO-SYNC] Aguardando o download do arquivo...');
    const downloadedFile = await waitForDownload(downloadPath, 60000);

    if (!downloadedFile) {
      throw new Error('Tempo esgotado aguardando o download do arquivo.');
    }

    console.log(`[AUTO-SYNC] Arquivo baixado: ${downloadedFile}`);

    // Ler e processar o arquivo
    const workbook = xlsx.readFile(downloadedFile);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { range: 10, raw: false });

    let countUpsert = 0;

    for (const row of rows) {
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

      if (!matricula) continue;

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

    // Limpar arquivo baixado
    try {
      fs.unlinkSync(downloadedFile);
      fs.rmdirSync(downloadPath);
    } catch (e) {
      console.warn('[AUTO-SYNC] Erro ao limpar diretório temporário:', e);
    }

    console.log(`[AUTO-SYNC] Concluído! ${countUpsert} registros processados.`);
    return countUpsert;

  } catch (error) {
    console.error('[AUTO-SYNC] Erro:', error);
    // Limpar se houver erro
    try {
      if (fs.existsSync(downloadPath)) {
        const files = fs.readdirSync(downloadPath);
        for (const file of files) {
          fs.unlinkSync(path.join(downloadPath, file));
        }
        fs.rmdirSync(downloadPath);
      }
    } catch (e) {
      console.warn('[AUTO-SYNC] Erro ao limpar pasta temporária após erro:', e);
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Hourly auto sync scheduler
export function startAutoSyncScheduler() {
  const ONE_HOUR = 60 * 60 * 1000;
  console.log('[SCHEDULER] Iniciando agendador de sincronização de hora em hora...');
  
  // Executa uma vez 5 segundos após a inicialização do servidor para garantir funcionamento imediato
  setTimeout(async () => {
    try {
      await runAutoSyncProgrammatically();
    } catch (e) {
      console.error('[SCHEDULER] Falha na primeira execução do auto-sync:', e.message);
    }
  }, 5000);

  // Define o intervalo periódico de 1 hora
  setInterval(async () => {
    try {
      await runAutoSyncProgrammatically();
    } catch (e) {
      console.error('[SCHEDULER] Falha na sincronização programada:', e.message);
    }
  }, ONE_HOUR);
}
