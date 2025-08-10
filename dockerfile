# Usa imagem oficial com Chromium + dependências já instaladas
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Copia package.json e instala deps em modo produção
COPY package*.json ./
RUN npm ci --omit=dev

# Copia o código
COPY . .

ENV NODE_ENV=production
# (opcional) garante path dos browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Arranca o teu script
CMD ["node", "watch-shotgun-discord.js"]
