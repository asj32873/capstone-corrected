FROM node:20-slim
ARG SERVICE
ENV SERVICE=${SERVICE}
WORKDIR /app
COPY package.json ./
COPY api/package.json api/
COPY ai/package.json ai/
RUN npm install --workspaces --omit=dev --legacy-peer-deps
COPY api api
COPY ai ai
CMD ["sh", "-c", "npm run start -w $SERVICE"]
