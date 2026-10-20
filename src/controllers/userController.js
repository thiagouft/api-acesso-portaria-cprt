import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { logOperacao } from '../services/logService.js';

export async function getUsers(request, reply) {
  const users = await prisma.usuario.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      login: true,
      cpf: true,
      perfil: true,
      refeitorios: {
        select: {
          refeitorio: {
            select: { id: true, descricao: true, ativo: true }
          }
        }
      }
    }
  });

  const formatted = users.map(u => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    login: u.login,
    cpf: u.cpf,
    perfil: u.perfil,
    refeitorios: (u.refeitorios || []).map(r => r.refeitorio)
  }));

  return reply.send(formatted);
}

export async function createUser(request, reply) {
  const { nome, email, login, cpf, senha, perfil, refeitorios } = request.body;

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        login,
        cpf,
        senha: hashedPassword,
        perfil,
        refeitorios: Array.isArray(refeitorios) && refeitorios.length > 0 ? {
          create: refeitorios.map(refId => ({
            id_refeitorio: parseInt(refId)
          }))
        } : undefined
      },
      include: {
        refeitorios: {
          include: { refeitorio: true }
        }
      }
    });

    await logOperacao(request.user.id, 'CREATE', 'Usuario', { id_criado: novoUsuario.id, login });
    
    // remover a senha do retorno
    const { senha: _, ...userSemSenha } = novoUsuario;
    return reply.status(201).send({
      ...userSemSenha,
      refeitorios: (novoUsuario.refeitorios || []).map(r => r.refeitorio)
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return reply.status(400).send({ error: 'Erro ao criar usuário, verifique se login/email/cpf já existem.' });
  }
}

export async function updateUser(request, reply) {
  const { id } = request.params;
  const { nome, email, login, cpf, senha, perfil, refeitorios } = request.body;
  const idNum = parseInt(id);

  try {
    const data = {};
    if (nome !== undefined) data.nome = nome.trim();
    if (email !== undefined) data.email = email.trim();
    if (login !== undefined) data.login = login.trim();
    if (cpf !== undefined) data.cpf = cpf.trim();
    if (perfil !== undefined) data.perfil = perfil;

    if (senha && senha.trim()) {
      data.senha = await bcrypt.hash(senha.trim(), 10);
    }

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id: idNum },
      data
    });

    if (refeitorios !== undefined) {
      await prisma.usuarioRefeitorio.deleteMany({
        where: { id_usuario: idNum }
      });
      if (Array.isArray(refeitorios) && refeitorios.length > 0) {
        await prisma.usuarioRefeitorio.createMany({
          data: refeitorios.map(refId => ({
            id_usuario: idNum,
            id_refeitorio: parseInt(refId)
          }))
        });
      }
    }

    const refeitoriosAtualizados = await prisma.usuarioRefeitorio.findMany({
      where: { id_usuario: idNum },
      include: { refeitorio: true }
    });

    await logOperacao(request.user.id, 'UPDATE', 'Usuario', { id_editado: idNum, login: usuarioAtualizado.login });

    const { senha: _, ...userSemSenha } = usuarioAtualizado;
    return reply.send({
      ...userSemSenha,
      refeitorios: refeitoriosAtualizados.map(r => r.refeitorio)
    });
  } catch (error) {
    console.error(error);
    return reply.status(400).send({ error: 'Erro ao atualizar usuário. Verifique se login/email/cpf já estão em uso.' });
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
