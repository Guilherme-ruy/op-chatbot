FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (aproveita cache de layer)
COPY package*.json ./
RUN npm ci

# Copia código-fonte
COPY . .

# Compila widget e TypeScript
RUN npm run build:widget && npm run build

# Copia arquivos SQL que o tsc não inclui automaticamente
RUN cp src/db/schema.sql dist/db/schema.sql && \
    cp src/db/admin_migration.sql dist/db/admin_migration.sql

# Remove devDependencies para imagem menor
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/server.js"]
