#!/bin/bash

# Script de verificación para deployment
echo "🔍 Verificando preparación para deployment..."

# Verificar archivos requeridos
echo "📂 Verificando archivos..."
files=(
    "Dockerfile"
    "docker-compose.yml"
    ".dockerignore"
    "package.json"
    "tsconfig.json"
    ".env.example"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file - OK"
    else
        echo "❌ $file - FALTA"
        exit 1
    fi
done

# Verificar que se puede compilar
echo "🔨 Verificando compilación..."
if npm run build; then
    echo "✅ Build - OK"
else
    echo "❌ Build - ERROR"
    exit 1
fi

# Verificar variables de entorno de ejemplo
echo "🔧 Verificando .env.example..."
required_vars=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "PORT"
    "NODE_ENV"
    "API_BASE_URL"
    "CORS_ORIGIN"
)

for var in "${required_vars[@]}"; do
    if grep -q "$var" .env.example; then
        echo "✅ $var - OK"
    else
        echo "❌ $var - FALTA en .env.example"
        exit 1
    fi
done

# Verificar que Docker funciona
echo "🐳 Verificando Docker..."
if command -v docker &> /dev/null; then
    echo "✅ Docker - INSTALADO"

    # Intentar build local
    echo "🔨 Probando build de Docker..."
    if docker build -t api-tesista-test .; then
        echo "✅ Docker Build - OK"

        # Limpiar imagen de prueba
        docker rmi api-tesista-test 2>/dev/null || true
    else
        echo "❌ Docker Build - ERROR"
        exit 1
    fi
else
    echo "⚠️  Docker - NO INSTALADO (será instalado en VPS)"
fi

echo ""
echo "🎉 ¡Preparación completa! Tu API está lista para deployment en Dokploy."
echo ""
echo "📋 Próximos pasos:"
echo "1. Sube tu código a Git repository"
echo "2. Configura la aplicación en Dokploy"
echo "3. Agrega las variables de entorno"
echo "4. Configura tu dominio"
echo "5. Deploy!"
echo ""
echo "📖 Lee DEPLOY_DOKPLOY.md para instrucciones detalladas."