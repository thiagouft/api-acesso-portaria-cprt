export async function authenticate(request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Não autorizado. Token inválido ou ausente.' })
  }
}

export async function authorizeMaster(request, reply) {
  try {
    await request.jwtVerify()
    if (request.user.perfil !== 'MASTER') {
      return reply.status(403).send({ error: 'Acesso negado. Apenas usuários MASTER têm permissão.' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Não autorizado. Token inválido ou ausente.' })
  }
}

export async function authorizeMasterOrRefeicao(request, reply) {
  try {
    await request.jwtVerify()
    if (!['MASTER', 'REFEICAO', 'REFEICAO_MULTI'].includes(request.user.perfil)) {
      return reply.status(403).send({ error: 'Acesso negado. Perfil sem permissão para módulo de refeição.' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Não autorizado. Token inválido ou ausente.' })
  }
}

