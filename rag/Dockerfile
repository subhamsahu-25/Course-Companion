FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY . ./
ENV NODE_ENV=production
# Cloud Run sets PORT automatically; server.js reads process.env.PORT.
CMD ["node", "server.js"]
