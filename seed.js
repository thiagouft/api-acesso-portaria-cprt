import bcrypt from 'bcrypt';
import prisma from './src/prisma.js';

async function main() {
  const adminExists = await prisma.usuario.findFirst({
    where: { perfil: 'MASTER' }
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.usuario.create({
      data: {
        nome: 'Administrador Master',
        email: 'admin@cprt.com',
        login: 'admin',
        cpf: '00000000000',
        senha: hashedPassword,
        perfil: 'MASTER'
      }
    });
    console.log('Usuário master criado: login "admin", senha "admin123"');
  } else {
    console.log('Usuário master já existe.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
