import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const accounts: Array<{
    email: string;
    name: string;
    role: string;
    status: string;
    password: string;
  }> = [
    { email: 'demo@slide.local', name: 'Демо Преподаватель', role: 'teacher', status: 'approved', password: 'demo12345' },
    { email: 'admin@slide.local', name: 'Администратор', role: 'admin', status: 'approved', password: 'admin12345' },
  ];

  for (const account of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: account.email,
          name: account.name,
          role: account.role,
          status: account.status,
          passwordHash: await bcrypt.hash(account.password, 12),
          salt: randomBytes(16).toString('hex'),
        },
      });
      console.log(`Создан ${account.role}: ${account.email} / ${account.password}`);
    } else {
      if (existing.role !== account.role || existing.status === 'pending') {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: account.role, status: 'approved' },
        });
        console.log(`Обновлён ${account.email}: role=${account.role}, status=approved`);
      } else {
        console.log(`${account.email} уже существует`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
