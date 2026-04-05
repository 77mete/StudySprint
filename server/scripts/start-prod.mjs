/**
 * Railway / üretim: migrate başarısız olsa bile HTTP sunucusu ayağa kalksın
 * (migrate && node tek satırında migrate patlayınca süreç hiç dinlemez → 502).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'dist', 'index.js')
const node = process.execPath

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const migrate = spawnSync(npx, ['prisma', 'migrate', 'deploy'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

if (migrate.status !== 0) {
  console.error(
    '[StudySprint] prisma migrate deploy failed (exit',
    migrate.status,
    '). DATABASE_URL / Supabase / migration dosyalarını kontrol edin. Sunucu yine de başlatılıyor.',
  )
}

const server = spawnSync(node, [entry], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

process.exit(server.status === null ? 1 : server.status)
