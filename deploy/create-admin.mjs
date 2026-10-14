// Creates (or resets the password of) an admin user inside the container:
//   docker compose exec app node tools/create-admin.mjs "Name" email@example.com 'StrongPass123'
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('Usage: node create-admin.mjs "Name" email password (10+ chars with a letter and a number)');
  process.exit(1);
}
const db = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);
const user = await db.user.upsert({
  where: { email: email.toLowerCase() },
  update: { passwordHash, role: "ADMIN", active: true, failedLogins: 0, lockedUntil: null },
  create: { name, email: email.toLowerCase(), passwordHash, role: "ADMIN" },
});
console.log(`Admin ready: ${user.email}`);
await db.$disconnect();
