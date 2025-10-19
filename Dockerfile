# Multi-stage build para optimizar tamaño de imagen
FROM node:18-alpine AS builder

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache python3 make g++

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# ✅ CAMBIO: Instalar TODAS las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Copiar código fuente
COPY src ./src

# Compilar TypeScript a JavaScript
RUN npm run build

# Imagen final de producción
FROM node:18-alpine AS production

# Crear usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S api -u 1001

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# ✅ Instalar solo dependencias de producción en la imagen final
RUN npm ci --only=production

# Copiar solo el código compilado desde builder
COPY --from=builder /app/dist ./dist

# Cambiar ownership al usuario no-root
RUN chown -R api:nodejs /app
USER api

# Exponer puerto
EXPOSE 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando para iniciar la aplicación
CMD ["node", "dist/index.js"]