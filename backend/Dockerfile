FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . ./
ENV NODE_ENV=production
# Cloud Run sets PORT automatically; src/server.js reads process.env.PORT.
CMD ["node", "src/server.js"]
