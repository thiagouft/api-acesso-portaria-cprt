import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function login(request, reply) {
  const { login, senha } = request.body;

  if (!login || !senha) {
    return reply.status(400).send({ error: 'Login e senha são obrigatórios.' });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { login }
  });

  if (!usuario) {
    return reply.status(401).send({ error: 'Credenciais inválidas.' });
  }

  const isPasswordValid = await bcrypt.compare(senha, usuario.senha);

  if (!isPasswordValid) {
    return reply.status(401).send({ error: 'Credenciais inválidas.' });
  }

  const token = await reply.jwtSign({
    id: usuario.id,
    login: usuario.login,
    perfil: usuario.perfil,
    nome: usuario.nome
  }, { expiresIn: '12h' });

  // Log de acesso
  await logOperacao(usuario.id, 'LOGIN', 'Usuario', { login });

  return reply.send({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      perfil: usuario.perfil
    }
  });
}
