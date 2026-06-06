import type { FastifyInstance } from 'fastify';
import { createWriteStream, unlink } from 'fs';
import { mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { requireAdmin } from '../../middleware/adminAuth';

const UPLOADS_DIR  = join(process.cwd(), 'uploads', 'avatars');
const MAX_SIZE     = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export async function adminUploadRoutes(app: FastifyInstance) {
  const auth = { preHandler: requireAdmin(app) };

  // Garante que a pasta existe (desenvolvimento sem Docker)
  await mkdir(UPLOADS_DIR, { recursive: true });

  /**
   * POST /api/admin/upload/avatar
   * Recebe uma imagem multipart e salva em uploads/avatars/.
   * Retorna a URL pública do arquivo.
   */
  app.post('/api/admin/upload/avatar', auth, async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'Nenhum arquivo enviado.' });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.code(400).send({ error: 'Formato inválido. Use JPG, PNG, WebP ou GIF.' });
    }

    const filename = `${randomUUID()}${ext}`;
    const filepath = join(UPLOADS_DIR, filename);

    // Salva o arquivo verificando o tamanho ao mesmo tempo
    await new Promise<void>((resolve, reject) => {
      let size = 0;
      const stream = createWriteStream(filepath);

      data.file.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_SIZE) {
          data.file.destroy();
          stream.destroy();
          unlink(filepath, () => {});
          reject(new Error('TOO_LARGE'));
        }
      });

      data.file.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', resolve);
      data.file.pipe(stream);
    }).catch(err => {
      if (err.message === 'TOO_LARGE') {
        throw reply.code(413).send({ error: 'Arquivo muito grande. Máximo: 2 MB.' });
      }
      throw err;
    });

    const url = `/uploads/avatars/${filename}`;
    return reply.send({ url });
  });

  /**
   * DELETE /api/admin/upload/avatar
   * Remove um avatar pelo caminho (body: { path: '/uploads/avatars/uuid.png' }).
   * Falha silenciosa se o arquivo não existir.
   */
  app.delete('/api/admin/upload/avatar', auth, async (request, reply) => {
    const { path } = request.body as { path?: string };

    // Aceita apenas caminhos dentro da pasta de avatars (segurança)
    if (!path || !path.startsWith('/uploads/avatars/')) {
      return reply.code(400).send({ error: 'Caminho inválido.' });
    }

    const filename = path.replace('/uploads/avatars/', '');
    // Bloqueia traversal (ex: ../../etc/passwd)
    if (filename.includes('/') || filename.includes('..')) {
      return reply.code(400).send({ error: 'Caminho inválido.' });
    }

    const filepath = join(UPLOADS_DIR, filename);
    unlink(filepath, () => {}); // falha silenciosa se não existir

    return reply.code(204).send();
  });
}
