# Imagen de la API de Afinia. Sirve igual en Railway o en un servidor propio.
FROM node:22-bookworm-slim AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
RUN npm ci --workspace shared --workspace api --include-workspace-root=false
COPY shared shared
COPY api api
RUN npm run build --workspace shared && npm run build --workspace api

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
RUN npm ci --omit=dev --workspace shared --workspace api --include-workspace-root=false && npm cache clean --force
COPY --from=compilar /app/shared/dist shared/dist
COPY --from=compilar /app/api/dist api/dist
RUN mkdir -p api/uploads && chown -R node:node api
USER node
WORKDIR /app/api
EXPOSE 3010
CMD ["node", "dist/main"]
