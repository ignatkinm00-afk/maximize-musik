# ─── Maximize Musik API ──────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY apps/api/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data

COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/package.json ./package.json
COPY apps/api/src ./src

RUN mkdir -p /data/uploads
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=6s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.ts"]
