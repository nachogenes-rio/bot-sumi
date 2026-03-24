# Bot WhatsApp SuMi Distribuidora

## Pasos para deployar en Railway

1. Subí este proyecto a GitHub (arrastrá la carpeta)
2. Copiá el archivo `Sumi_.xlsx` en esta misma carpeta
3. En Railway: New Project → Deploy from GitHub
4. Agregá las variables de entorno:
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
5. Copiá la URL de Railway
6. En Twilio: Sandbox Settings → "When a message comes in" → pegá la URL + /webhook

## Usuarios por defecto
Contraseña de todos: 1234
- aquino
- cristaldo
- lopez
- molina
- adaro
- carabajal
- chaparro
- dotta
- valiente
- velazquez

Para cambiar contraseñas, editá el objeto USUARIOS en index.js
