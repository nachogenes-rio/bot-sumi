# Bot WhatsApp SuMi Distribuidora

## Archivos necesarios en el repo

```
bot-sumi/
├── index.js        ← el bot
├── package.json    ← dependencias
├── Sumi_.xlsx      ← el Excel (OBLIGATORIO, sin este no arranca)
└── README.md
```

---

## Paso a paso para deployar en Railway

### 1. Subir a GitHub

1. Andá a github.com → New repository → nombre: `bot-sumi`
2. Subí los 3 archivos: `index.js`, `package.json`, `Sumi_.xlsx`
   - ⚠️ El Excel **tiene que estar** en el repo, es esencial

### 2. Crear proyecto en Railway

1. Andá a railway.app → **New Project**
2. Elegí **Deploy from GitHub repo**
3. Seleccioná `bot-sumi`
4. Railway detecta el `package.json` y arranca automáticamente

### 3. Agregar variables de entorno

En Railway → tu proyecto → pestaña **Variables** → agregar:

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave de Anthropic (empieza con `sk-ant-...`) |
| `TWILIO_ACCOUNT_SID` | de tu cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | de tu cuenta Twilio |

### 4. Verificar que está corriendo

- Railway te da una URL tipo: `https://bot-sumi-production.up.railway.app`
- Abrí esa URL en el navegador → tiene que decir `OK`
- Si dice `OK`, el servidor está vivo ✅

### 5. Configurar Twilio

1. Andá a Twilio → Messaging → Sandbox Settings (o tu número)
2. En **"When a message comes in"** pegá:
   ```
   https://TU-URL.railway.app/webhook
   ```
3. Método: **HTTP POST**
4. Guardá

---

## Usuarios y contraseñas

| Usuario | Contraseña | Vendedor |
|---|---|---|
| aquino | 1234 | Jonatan Aquino |
| cristaldo | 5678 | Claudia Cristaldo |
| lopez | 1234 | Daniela Lopez |
| molina | 1234 | Tomas Molina |
| adaro | 1234 | Alberto Adaro |
| carabajal | 1234 | Sandra Carabajal |
| chaparro | 1234 | Betiana Chaparro |
| dotta | 1234 | Maximiliano Dotta |
| valiente | 1234 | Alejandro Valiente |
| velazquez | 1234 | Alejandra Velazquez |
| olivera | 1234 | Dana Olivera |
| reynoso | 1234 | Marcela Reynoso |
| rios | 1234 | Ana Rios |

---

## Si algo no funciona

### "Figura caído" en Railway
→ Abrí los logs (Deployments → tu deploy → View Logs)
→ Buscá líneas con ❌
→ Lo más común: falta el `Sumi_.xlsx` en el repo

### "No responde al hola" en WhatsApp
→ Verificá que la URL en Twilio termina en `/webhook`
→ Verificá que las variables de entorno están cargadas en Railway

### Cómo actualizar el Excel
1. Reemplazá el `Sumi_.xlsx` en GitHub
2. Railway hace redeploy automático
