FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG API_BASE_URL=http://localhost:8080/api/v1
ARG AI_BASE_URL=http://localhost:8080/api/v1
ARG ONLYOFFICE_URL=http://localhost:8082
RUN npm run build

FROM nginx:1.27-alpine AS runtime

ENV API_BASE_URL=http://localhost:8080/api/v1
ENV AI_BASE_URL=http://localhost:8080/api/v1
ENV ONLYOFFICE_URL=http://localhost:8082

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/FlowRoad-Frontend/browser /usr/share/nginx/html
COPY docker-entrypoint.d/40-flowroad-runtime-config.sh /docker-entrypoint.d/40-flowroad-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-flowroad-runtime-config.sh

EXPOSE 80
