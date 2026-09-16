#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "ERP PLANIFICACION 6.33.5 - Publicar SOLO reglas Firestore"
echo "Proyecto: inventario-psi"
if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI no esta instalado. Instale con: npm install -g firebase-tools"
  read -p "Presione Enter para cerrar..."
  exit 1
fi
firebase use inventario-psi
firebase deploy --only firestore:rules
printf '\nReglas Firestore publicadas. Vuelva al ERP y pulse Sincronizar ahora.\n'
read -p "Presione Enter para cerrar..."
