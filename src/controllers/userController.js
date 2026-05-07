import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function getUsers(request, reply) {
  const users = await prisma.usuario.findMany({
    select: { id: true, nome: true, email: true, login: true, cpf: true, perfil: true }
  });
  return reply.send(users);
}

export async function createUser(request, reply) {
  const { nome, email, login, cpf, senha, perfil } = request.body;

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const novoUsuario = await prisma.usuario.create({
      data: { nome, email, login, cpf, senha: hashedPassword, perfil }
    });

    await logOperacao(request.user.id, 'CREATE', 'Usuario', { id_criado: novoUsuario.id, login });
    
    // remover a senha do retorno
    const { senha: _, ...userSemSenha } = novoUsuario;
    return reply.status(201).send(userSemSenha);
  } catch (error) {
    return reply.status(400).send({ error: 'Erro ao criar usuário, verifique se login/email/cpf já existem.' });
  }
}

export async function deleteUser(request, reply) {
  const { id } = request.params;
  
  if (parseInt(id) === request.user.id) {
     return reply.status(400).send({ error: 'Não é possível excluir o próprio usuário autenticado.' });
  }

  try {
    await prisma.usuario.delete({ where: { id: parseInt(id) } });
    await logOperacao(request.user.id, 'DELETE', 'Usuario', { id_removido: id });
    return reply.status(204).send();
  } catch (error) {
    return reply.status(400).send({ error: 'Erro ao deletar usuário.' });
  }
}
