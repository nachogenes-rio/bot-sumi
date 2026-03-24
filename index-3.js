const express = require('express');
const twilio  = require('twilio');
const XLSX    = require('xlsx');
const path    = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Log TODOS los requests que llegan — para diagnóstico
app.use((req, res, next) => {
  console.log(`▶ ${req.method} ${req.path} | body:`, JSON.stringify(req.body).slice(0, 200));
  next();
});

// ─── USUARIOS ────────────────────────────────────────────────
const USUARIOS = {
  'aquino':    { pass: '1234', vendedor: 'AQUINO, JONATAN, 30',      nombre: 'Jonatan Aquino' },
  'cristaldo': { pass: '5678', vendedor: 'CRISTALDO, CLAUDIA, 31',   nombre: 'Claudia Cristaldo' },
  'lopez':     { pass: '1234', vendedor: 'LOPEZ, DANIELA, 32',       nombre: 'Daniela Lopez' },
  'molina':    { pass: '1234', vendedor: 'MOLINA, TOMAS, 34',        nombre: 'Tomas Molina' },
  'adaro':     { pass: '1234', vendedor: 'ADARO, ALBERTO, 41',       nombre: 'Alberto Adaro' },
  'carabajal': { pass: '1234', vendedor: 'CARABAJAL, SANDRA, 42',    nombre: 'Sandra Carabajal' },
  'chaparro':  { pass: '1234', vendedor: 'CHAPARRO, BETIANA, 43',    nombre: 'Betiana Chaparro' },
  'dotta':     { pass: '1234', vendedor: 'DOTTA, MAXIMILIANO, 44',   nombre: 'Maximiliano Dotta' },
  'valiente':  { pass: '1234', vendedor: 'VALIENTE, ALEJANDRO, 46',  nombre: 'Alejandro Valiente' },
  'velazquez': { pass: '1234', vendedor: 'VELAZQUEZ, ALEJANDRA, 36', nombre: 'Alejandra Velazquez' },
  'olivera':   { pass: '1234', vendedor: 'OLIVERA, DANA, 38',        nombre: 'Dana Olivera' },
  'reynoso':   { pass: '1234', vendedor: 'REYNOSO, MARCELA, 39',     nombre: 'Marcela Reynoso' },
  'rios':      { pass: '1234', vendedor: 'RIOS, ANA, 40',            nombre: 'Ana Rios' },
};

// ─── BASE DE DATOS ───────────────────────────────────────────
let DB = { clientes: [], sin_vender: [], avance: [] };

function cargarExcel() {
  const xlsxPath = path.join(__dirname, 'Sumi_.xlsx');
  console.log('📂 Buscando Excel en:', xlsxPath);
  try {
    const wb = XLSX.readFile(xlsxPath);
    console.log('📋 Hojas encontradas:', wb.SheetNames.join(', '));

    const raw = XLSX.utils.sheet_to_json(wb.Sheets['Sumi UF'], { header: 1 });
    const h   = raw[6];
    DB.clientes = raw.slice(7).filter(r => r[0]).map(r => ({
      cod:        String(r[h.indexOf('COD.CL')]        || '').replace('.0', ''),
      razon:      String(r[h.indexOf('RAZON SOCIAL')]  || '').trim(),
      dir:        String(r[h.indexOf('DIRECCION')]     || '').trim(),
      loc:        String(r[h.indexOf('LOCALIDAD')]     || '').trim(),
      vendedor:   String(r[h.indexOf('VENDEDOR')]      || '').trim(),
      cluster:    String(r[h.indexOf('CLUSTER')]       || '').trim(),
      dia:        String(r[h.indexOf('DIA DE VISITA')] || '').trim(),
      kg:         parseFloat(r[h.indexOf('KG ACUM.')]   || 0) || 0,
      sku:        parseFloat(r[h.indexOf('CANT. SKU')]  || 0) || 0,
      finita:     parseFloat(r[h.indexOf('FINITA')]     || 0) || 0,
      mediana:    parseFloat(r[h.indexOf('MEDIANA')]    || 0) || 0,
      clasica:    parseFloat(r[h.indexOf('CLASICA')]    || 0) || 0,
      parrillera: parseFloat(r[h.indexOf('PARRILLERA')] || 0) || 0,
      s230:       parseFloat(r[h.indexOf('230GR')]      || 0) || 0,
      s190:       parseFloat(r[h.indexOf('190GR')]      || 0) || 0,
      sx12:       parseFloat(r[h.indexOf('X12')]        || 0) || 0,
      mila:       parseFloat(r[h.indexOf('MILA/NUGG')]  || 0) || 0,
      faltante:   String(r[h.indexOf('FALTANTE')]       || '').trim(),
    }));

    const raw2 = XLSX.utils.sheet_to_json(wb.Sheets['CL sin Vender'], { header: 1 });
    DB.sin_vender = raw2.slice(1).filter(r => r[0]).map(r => ({
      cod:      String(r[0] || '').replace('.0', ''),
      razon:    String(r[1] || '').trim(),
      loc:      String(r[3] || '').trim(),
      vendedor: String(r[4] || '').trim(),
      dia:      String(r[5] || '').trim(),
    }));

    const raw3   = XLSX.utils.sheet_to_json(wb.Sheets['Avance xVend.'], { header: 1 });
    const validV = ['ADARO','AQUINO','CARABAJAL','CHAPARRO','CRISTALDO','DOTTA',
                    'LOPEZ','MOLINA','OLIVERA','REYNOSO','RIOS','VALIENTE','VELAZQUEZ'];
    DB.avance = raw3.slice(4)
      .filter(r => r[1] && validV.some(v => String(r[1]).toUpperCase().includes(v)))
      .map(r => ({
        vendedor:   String(r[1]).trim(),
        obj_total:  parseFloat(r[2])  || 0,
        av_total:   parseFloat(r[3])  || 0,
        proyeccion: parseFloat(r[4])  || 0,
        pct_total:  parseFloat(r[5])  || 0,
        obj_hamb:   parseFloat(r[6])  || 0,
        av_hamb:    parseFloat(r[7])  || 0,
        pct_hamb:   parseFloat(r[8])  || 0,
        obj_salch:  parseFloat(r[9])  || 0,
        av_salch:   parseFloat(r[10]) || 0,
        pct_salch:  parseFloat(r[11]) || 0,
        obj_rebo:   parseFloat(r[12]) || 0,
        av_rebo:    parseFloat(r[13]) || 0,
        pct_rebo:   parseFloat(r[14]) || 0,
      }));

    console.log(`✅ Excel OK: ${DB.clientes.length} clientes | ${DB.sin_vender.length} sin vender | ${DB.avance.length} vendedores`);
  } catch (e) {
    console.error('❌ FATAL — No pude leer el Excel:', e.message);
    console.error('   Asegurate de que Sumi_.xlsx está en la raíz del proyecto en Railway');
  }
}

// ─── HELPERS ─────────────────────────────────────────────────
function getClientes(vendedor) {
  return DB.clientes.filter(c => c.vendedor === vendedor);
}
function getSinVender(vendedor) {
  const [apellido, nombre] = vendedor.split(',').map(p => p.trim().toUpperCase());
  return DB.sin_vender.filter(c => {
    const v = c.vendedor.toUpperCase();
    return v.includes(apellido) && (!nombre || v.includes(nombre));
  });
}
function getAvance(vendedor) {
  const [apellido, nombre] = vendedor.split(',').map(p => p.trim().toUpperCase());
  return DB.avance.find(a => {
    const v = a.vendedor.toUpperCase();
    return v.includes(apellido) && (!nombre || v.includes(nombre));
  }) || null;
}
function fmtPct(v) { return Math.round((v || 0) * 100) + '%'; }
function fmtKg(v)  { return (Math.round((v || 0) * 10) / 10) + ' kg'; }

function buildContexto(vendedor) {
  const clientes  = getClientes(vendedor);
  const sinVender = getSinVender(vendedor);
  const avance    = getAvance(vendedor);
  return JSON.stringify({
    vendedor,
    total_clientes: clientes.length,
    clientes: clientes.map(c => ({
      cod: c.cod, nombre: c.razon, barrio: c.loc, cluster: c.cluster,
      dia: c.dia, kg: Math.round(c.kg * 10) / 10, sku: c.sku,
      hamburguesas: { finita: !!c.finita, mediana: !!c.mediana, clasica: !!c.clasica, parrillera: !!c.parrillera },
      salchichas:   { s230: !!c.s230, s190: !!c.s190, x12: !!c.sx12 },
      rebozados:    { mila_o_nugg: !!c.mila },
      faltantes:    (c.faltante && c.faltante !== 'nan') ? c.faltante.replace(/\+/g, ', ') : null,
    })),
    sin_vender: sinVender.map(c => ({ cod: c.cod, nombre: c.razon, barrio: c.loc, dia: c.dia })),
    avance: avance ? {
      kg_vendidos: Math.round(avance.av_total * 10) / 10,
      objetivo:    Math.round(avance.obj_total * 10) / 10,
      proyeccion:  Math.round(avance.proyeccion * 10) / 10,
      pct_avance:  fmtPct(avance.pct_total),
      hamburguesas: { vendido: fmtKg(avance.av_hamb),  objetivo: fmtKg(avance.obj_hamb),  pct: fmtPct(avance.pct_hamb) },
      salchichas:   { vendido: fmtKg(avance.av_salch), objetivo: fmtKg(avance.obj_salch), pct: fmtPct(avance.pct_salch) },
      rebozados:    { vendido: fmtKg(avance.av_rebo),  objetivo: fmtKg(avance.obj_rebo),  pct: fmtPct(avance.pct_rebo) },
    } : null,
  });
}

// ─── LLAMADA A CLAUDE ─────────────────────────────────────────
async function preguntarIA(pregunta, contexto, historial) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY no está configurada en Railway');
    return '⚠️ Sin clave de IA. Contactá al administrador.';
  }
  const system = `Sos el asistente de ventas de SuMi Distribuidora. Respondés preguntas de vendedores sobre sus clientes y rendimiento.
Productos: Hamburguesas (Finita, Mediana, Clásica, Parrillera) | Salchichas (230g, 190g, x12) | Rebozados (Milanesas/Nuggets)
Reglas: respondé en español, usá emojis para WhatsApp, máximo 10 clientes por lista, nunca inventes datos.
Datos del vendedor:\n${contexto}`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system,
        messages: [...historial, { role: 'user', content: pregunta }],
      }),
    });
    const data = await res.json();
    if (data.error) { console.error('❌ Claude API:', JSON.stringify(data.error)); return '⚠️ Error con la IA. Intentá de nuevo.'; }
    if (!data.content?.[0]?.text) { console.error('❌ Respuesta vacía:', JSON.stringify(data)); return '⚠️ Sin respuesta. Intentá de nuevo.'; }
    return data.content[0].text;
  } catch (e) {
    console.error('❌ Fetch a Claude falló:', e.message);
    return '⚠️ No pude conectarme con la IA. Intentá de nuevo.';
  }
}

// ─── SESIONES ─────────────────────────────────────────────────
const sesiones = {};
function getSesion(tel) {
  if (!sesiones[tel]) sesiones[tel] = { estado: 'inicio', historial: [] };
  return sesiones[tel];
}

// ─── HEALTH CHECKS ────────────────────────────────────────────
app.get('/',       (_, res) => res.send('OK'));
app.get('/health', (_, res) => res.json({ status: 'ok', clientes: DB.clientes.length }));

// ─── WEBHOOK ─────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const from  = (req.body.From || '').replace('whatsapp:', '').trim();
  const texto = (req.body.Body || '').trim();

  console.log(`📩 from="${from}" texto="${texto}"`);

  if (!from || !texto) {
    console.warn('⚠️ Request sin From o Body — ignorado');
    return res.type('text/xml').send('<Response></Response>');
  }

  const s   = getSesion(from);
  const msg = texto.toLowerCase();
  let respuesta;

  if (msg === 'salir' || msg === '0' || msg === 'logout') {
    const nombre = s.nombre || 'usuario';
    sesiones[from] = { estado: 'inicio', historial: [] };
    respuesta = `👋 Hasta luego, *${nombre}*! Escribí *hola* para volver.`;
  }
  else if (s.estado === 'inicio' || msg === 'hola' || msg === 'start' || msg === 'hi') {
    s.estado = 'esperando_usuario'; s.historial = []; s.usuario = null; s.vendedor = null; s.nombre = null;
    respuesta = '👋 Bienvenido al sistema de consultas *SuMi Distribuidora*.\n\nIngresá tu *usuario*:';
  }
  else if (s.estado === 'esperando_usuario') {
    const user = msg.replace(/\s/g, '');
    if (USUARIOS[user]) {
      s.usuario = user; s.estado = 'esperando_pass';
      respuesta = '🔑 Ingresá tu *contraseña*:';
    } else {
      respuesta = '❌ Usuario no encontrado.\n\nUsá tu apellido en minúsculas: *molina*, *aquino*, *lopez*...';
    }
  }
  else if (s.estado === 'esperando_pass') {
    const u = USUARIOS[s.usuario];
    if (texto === u.pass) {
      s.vendedor = u.vendedor; s.nombre = u.nombre; s.estado = 'chat'; s.historial = [];
      s.contexto = buildContexto(u.vendedor);
      const sinV = getSinVender(u.vendedor).length;
      const clis = getClientes(u.vendedor).length;
      respuesta = `✅ *¡Bienvenido, ${u.nombre}!*\n\n📊 Tenés *${clis} clientes* y *${sinV} sin comprar* esta semana.\n\n🤖 Preguntame lo que quieras:\n• _¿Cómo voy contra el objetivo?_\n• _¿Qué clientes no compraron?_\n• _¿A quién le falta finita?_\n• _Dame info de [cliente]_\n\n_(Escribí *salir* para cerrar sesión)_`;
    } else {
      s.estado = 'inicio'; s.usuario = null;
      respuesta = '❌ Contraseña incorrecta. Escribí *hola* para intentar de nuevo.';
    }
  }
  else if (s.estado === 'chat') {
    s.historial.push({ role: 'user', content: texto });
    if (s.historial.length > 8) s.historial = s.historial.slice(-8);
    respuesta = await preguntarIA(texto, s.contexto, s.historial.slice(0, -1));
    s.historial.push({ role: 'assistant', content: respuesta });
    if (s.historial.length > 8) s.historial = s.historial.slice(-8);
  }
  else {
    s.estado = 'inicio';
    respuesta = '👋 Escribí *hola* para empezar.';
  }

  console.log(`📤 → "${respuesta.slice(0, 80)}..."`);
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuesta);
  res.type('text/xml').send(twiml.toString());
});

// ─── ARRANQUE ─────────────────────────────────────────────────
cargarExcel();
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Corriendo en puerto ${PORT}`));
