# Deploy — Guia de Produção

## Pré-requisitos

- VPS com Linux (Ubuntu 22.04+)
- Docker + Docker Compose instalados
- Domínio apontando para o IP da VPS (registro A)
- PostgreSQL instalado na VPS ou em container

---

## 1. Enviar o projeto para a VPS

```bash
# Opção A — via Git (recomendado)
git push origin main
# Na VPS:
git clone https://github.com/your-username/op-chatbot.git /opt/op-chatbot

# Opção B — via SCP
scp -r . root@SEU_IP_VPS:/opt/op-chatbot
```

---

## 2. Na VPS — configurar o .env

```bash
cd /opt/op-chatbot
cp .env.example .env
nano .env   # preencha todas as variáveis
```

---

## 3. Na VPS — instalar Docker (se ainda não tiver)

```bash
curl -fsSL https://get.docker.com | sh
```

---

## 4. Na VPS — criar usuário admin e subir o container

```bash
cd /opt/op-chatbot

# Cria o usuário do painel admin (apenas na primeira vez)
npm run db:admin-migrate

# Subir container — o schema do banco é aplicado automaticamente na inicialização
docker compose up -d --build
docker compose ps          # deve mostrar "healthy"
curl http://localhost:3050/health   # deve retornar {"status":"ok"}
```

> O `npm run db:migrate` não é necessário em produção. O servidor aplica
> o schema automaticamente ao iniciar.

---

## 5. Na VPS — configurar o Nginx

```bash
# Substitua your-domain.com pelo seu domínio antes de copiar
cp deploy/nginx.conf /etc/nginx/sites-available/your-domain.com
ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 6. Na VPS — SSL com Certbot (Let's Encrypt)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
# Certbot adiciona HTTPS automático e renova sozinho
```

---

## 7. Verificação final

1. Acesse `https://your-domain.com/health` — deve retornar `{"status":"ok"}`
2. Acesse `https://your-domain.com/admin` — deve abrir o painel de login
3. Instale o widget em um site de teste e faça uma conversa completa
4. Confirme o recebimento do e-mail de notificação de lead