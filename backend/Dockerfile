# Node 24 per the latest confirmation with Hitesh (supersedes the launch plan's Node 22).
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# logs/ is mounted as a volume in compose — created here so the mount has
# somewhere to land even before the first write.
RUN mkdir -p logs && chown -R node:node /app
USER node

EXPOSE 5000

CMD ["node", "server.js"]
