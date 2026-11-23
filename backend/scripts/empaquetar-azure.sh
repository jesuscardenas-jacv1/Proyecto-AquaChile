#!/usr/bin/env bash
# Arma el paquete del backend para Azure App Service (despliegue por zip).
# Uso: bash backend/scripts/empaquetar-azure.sh [ruta/salida.zip]
#
# Incluye el backend y una copia de los datos de demostración del frontend (src/datos),
# que la semilla necesita: en el servidor se indican con SEMILLA_DATOS=/home/site/wwwroot/datos-semilla.
# Las dependencias las instala Azure al desplegar (SCM_DO_BUILD_DURING_DEPLOYMENT=true).
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
SALIDA="${1:-$RAIZ/backend/despliegue-azure.zip}"
TEMPORAL="$(mktemp -d)"
trap 'rm -rf "$TEMPORAL"' EXIT

cp -R "$RAIZ/backend/src" "$RAIZ/backend/package.json" "$RAIZ/backend/package-lock.json" "$TEMPORAL/"
rm -f "$TEMPORAL"/src/*.test.js "$TEMPORAL"/src/*/*.test.js "$TEMPORAL/src/probar_api.js"

mkdir -p "$TEMPORAL/datos-semilla"
for archivo in semillaBase.js constantes.js demoPlanner.js demoPostulaciones.js ofertasAquaChile.js bdSimulada.json; do
  cp "$RAIZ/src/datos/$archivo" "$TEMPORAL/datos-semilla/"
done
# Descriptores de demostración: la IA los lee cuando el cargo no tiene uno guardado.
cp -R "$RAIZ/public/descriptores" "$TEMPORAL/descriptores"
# Los datos del frontend son módulos ES; el backend es CommonJS.
echo '{ "type": "module" }' > "$TEMPORAL/datos-semilla/package.json"

# Si la semilla importa un archivo que no va en el paquete, el servidor no podría sembrar ni restablecer datos.
for importado in $(grep -hoE "from '\./[^']+'" "$TEMPORAL"/datos-semilla/*.js | sed -E "s#from '\./([^']+)'#\1#" | sort -u); do
  if [ ! -f "$TEMPORAL/datos-semilla/$importado" ]; then
    echo "❌ Falta src/datos/$importado en el paquete: agréguelo a la lista de este script." >&2
    exit 1
  fi
done

rm -f "$SALIDA"
(cd "$TEMPORAL" && zip -qr "$SALIDA" .)
echo "Paquete listo: $SALIDA ($(du -h "$SALIDA" | cut -f1))"
