import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { logOperacao } from '../services/logService.js';

const uploadDir = path.resolve('./uploads');
const filePath = path.join(uploadDir, 'app-leitor.apk');

// Garantir que o diretório de uploads existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export async function uploadAPK(request, reply) {
  const data = await request.file();

  if (!data) {
    return reply.status(400).send({ error: 'Nenhum arquivo enviado.' });
  }

  const filename = data.filename;
  if (!filename.toLowerCase().endsWith('.apk')) {
    return reply.status(400).send({ error: 'Apenas arquivos com extensão .apk são permitidos.' });
  }

  try {
    // Salvar o arquivo
    await pipeline(data.file, fs.createWriteStream(filePath));

    // Pegar o tamanho para logs e retorno
    const stats = fs.statSync(filePath);

    // Salvar log da operação
    await logOperacao(
      request.user?.id,
      'UPLOAD_APK',
      'APK',
      { filename: 'app-leitor.apk', size: stats.size }
    );

    return reply.send({
      message: 'APK atualizado com sucesso!',
      size: stats.size,
      updatedAt: stats.mtime
    });
  } catch (error) {
    console.error('Erro no upload do APK:', error);
    return reply.status(500).send({ error: 'Erro ao salvar o arquivo APK.' });
  }
}

export async function downloadAPK(request, reply) {
  if (!fs.existsSync(filePath)) {
    return reply.status(404).send({ error: 'Nenhum aplicativo APK disponível para download no momento.' });
  }

  try {
    reply.header('Content-Disposition', 'attachment; filename="app-leitor-nfc.apk"');
    // sendFile gerencia automaticamente Range requests, Content-Type, Content-Length e chunking.
    return reply.sendFile('app-leitor.apk', uploadDir);
  } catch (error) {
    console.error('Erro no download do APK:', error);
    return reply.status(500).send({ error: 'Erro ao processar o download do APK.' });
  }
}

export async function getAPKInfo(request, reply) {
  if (!fs.existsSync(filePath)) {
    return reply.send({ exists: false });
  }

  try {
    const stats = fs.statSync(filePath);
    return reply.send({
      exists: true,
      size: stats.size,
      updatedAt: stats.mtime
    });
  } catch (error) {
    console.error('Erro ao obter info do APK:', error);
    return reply.status(500).send({ error: 'Erro ao ler metadados do APK.' });
  }
}
