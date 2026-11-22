FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8080 40000/udp 40000/tcp 40001/udp 40001/tcp 40002/udp 40002/tcp 40003/udp 40003/tcp
CMD ["node", "dist/main.js"]
