const express = require('express');
const twilio = require('twilio');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;

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
  'reynoso':   { pass: '1234', vendedor: 'REYNOSO, MARCELA 39',      nombre: 'Marcela Reynoso' },
  'rios':      { pass: '1234', vendedor: 'RIOS, ANA, 40',            nombre: 'Ana Rios' },
};

let DB = { clientes: [], sin_vender: [], avance: [], flia: [] };

function cargarExcel() {
  try {
    const wb = XLSX.readFile(path.join(__dirname, 'Sumi_.xlsx'));
    const ws = wb.Sheets['Sumi UF'];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const h = raw[6];
    DB.clientes = raw.slice(7).filter(r => r[0]).map(r => ({
      cod: String(r[h.indexOf('COD.CL')]||'').replace('.0',''),
      razon: String(r[h.indexOf('RAZON SOCIAL')]||'').trim(),
      dir: String(r[h.indexOf('DIRECCION')]||'').trim(),
      loc: String(r[h.indexOf('LOCALIDAD')]||'').trim(),
      vendedor: String(r[h.indexOf('VENDEDOR')]||'').trim(),
      cluster: String(r[h.indexOf('CLUSTER')]||'').trim(),
      dia: String(r[h.indexOf('DIA DE VISITA')]||'').trim(),
      kg: parseFloat(r[h.indexOf('KG ACUM.')]||0)||0,
      sku: parseFloat(r[h.indexOf('CANT. SKU')]||0)||0,
      finita: parseFloat(r[h.indexOf('FINITA')]||0)||0,
      mediana: parseFloat(r[h.indexOf('MEDIANA')]||0)||0,
      clasica: parseFloat(r[h.indexOf('CLASICA')]||0)||0,
      parrillera: parseFloat(r[h.indexOf('PARRILLERA')]||0)||0,
      s230: parseFloat(r[h.indexOf('230GR')]||0)||0,
      s190: parseFloat(r[h.indexOf('190GR')]||0)||0,
      sx12: parseFloat(r[h.indexOf('X12')]||0)||0,
      mila: parseFloat(r[h.indexOf('MILA/NUGG')]||0)||0,
      faltante: String(r[h.indexOf('FALTANTE')]||'').trim(),
    }));
    const ws2 = wb.Sheets['CL sin Vender'];
    const raw2 = XLSX.utils.sheet_to_json(ws2, { header: 1 });
    DB.sin_vender = raw2.slice(1).filter(r=>r[0]).map(r=>({
      cod: String(r[0]).replace('.0',''), razon: String(r[1]||'').trim(),
      dir: String(r[2]||'').trim(), loc: String(r[3]||'').trim(),
      vendedor: String(r[4]||'').trim(), dia: String(r[5]||'').trim(),
    }));
    const ws3 = wb.Sheets['Avance xVend.'];
    const raw3 = XLSX.utils.sheet_to_json(ws3, { header: 1 });
    const validV = ['ADARO','AQUINO','CARABAJAL','CHAPARRO','CRISTALDO','DOTTA','FORMENTE','LOPEZ','MOLINA','OLIVERA','MUNOZ','REYNOSO','RIOS','VALIENTE','VELAZQUEZ'];
    DB.avance = raw3.slice(4).filter(r=>r[1]&&validV.some(v=>String(r[1]).toUpperCase().includes(v))).map(r=>({
      vendedor: String(r[1]).trim(),
      obj_total: parseFloat(r[2])||0, av_total: parseFloat(r[3])||0,
      proyeccion: parseFloat(r[4])||0, pct_total: parseFloat(r[5])||0,
      obj_hamb: parseFloat(r[6])||0, av_hamb: parseFloat(r[7])||0, pct_hamb: parseFloat(r[8])||0,
      obj_salch: parseFloat(r[9])||0, av_salch: parseFloat(r[10])||0, pct_salch: parseFloat(r[11])||0,
      obj_rebo: parseFloat(r[12])||0, av_rebo: parseFloat(r[13])||0, pct_rebo: parseFloat(r[14])||0,
    }));
    console.log(`✅ Excel cargado: ${DB.clientes.length} clientes`);
  } catch(e) { console.error('❌ Error Excel:', e.message); }
}

function getClientesPorVendedor(v) { return DB.clientes.filter(c=>c.vendedor===v); }
function getSinVender(v) { const ap=v.split(',')[0].trim().toUpperCase(); return DB.sin_vender.filter(c=>c.vendedor.toUpperCase().includes(ap)); }
function getAvance(v) { const ap=v.split(',')[0].trim().toUpperCase(); return DB.avance.find(a=>a.vendedor.toUpperCase().includes(ap))||null; }
function pct(v) { return Math.round((v||0)*100)+'%'; }
function kg(v) { return Math.round((v||0)*10)/10+' kg'; }

// ─── FICHA CLIENTE ────────────────────────────────────────────
function fichaCliente(c) {
  const faltantes = [];
  if (!c.finita)     faltantes.push('Finita (hamb.)');
  if (!c.mediana)    faltantes.push('Mediana (hamb.)');
  if (!c.clasica)    faltantes.push('Clásica (hamb.)');
  if (!c.parrillera) faltantes.push('Parrillera (hamb.)');
  if (!c.s230)       faltantes.push('Salch. 230g');
  if (!c.s190)       faltantes.push('Salch. 190g');
  if (!c.sx12)       faltantes.push('Salch. x12');
  if (!c.mila)       faltantes.push('Mila/Nuggets');
  let r = `📋 *${c.razon}*\n\n📍 ${c.dir}, ${c.loc}\n🏷️ Cluster: ${c.cluster}\n📅 Visita: ${c.dia}\n📦 KG acumulados: *${kg(c.kg)}*\n🛒 SKUs activos: ${c.sku}/7\n\n`;
  if (faltantes.length) {
    r += `❌ *Faltantes (${faltantes.length}):*\n` + faltantes.map(f=>`  • ${f}`).join('\n');
  } else {
    r += `✅ Cartera completa`;
  }
  return r + '\n\nEscribí *menu* para volver.';
}

// ─── MENÚ ─────────────────────────────────────────────────────
function menuPrincipal(nombre) {
  return `✅ *Bienvenido, ${nombre}!*\n\n¿Qué querés consultar?\n\n1️⃣ Mi avance vs objetivo\n2️⃣ Clientes sin vender\n3️⃣ Buscar cliente\n4️⃣ Filtrar por cluster\n5️⃣ Ver todos los faltantes\n0️⃣ Cerrar sesión\n\n💡 También podés escribir directamente:\n• *faltantes de [nombre]*\n• *buscar [nombre o código]*`;
}

// ─── SESIONES ─────────────────────────────────────────────────
const sesiones = {};
function getSesion(tel) {
  if (!sesiones[tel]) sesiones[tel] = { estado: 'inicio' };
  return sesiones[tel];
}

// ─── LÓGICA DEL BOT ──────────────────────────────────────────
function procesarMensaje(tel, texto) {
  const s = getSesion(tel);
  const msg = texto.trim().toLowerCase();

  if (s.estado === 'inicio' || msg === 'hola' || msg === 'start') {
    s.estado = 'esperando_usuario';
    return '👋 Bienvenido al sistema de consultas *SuMi Distribuidora*.\n\nIngresá tu *usuario*:';
  }

  if (s.estado === 'esperando_usuario') {
    const user = msg.replace(/\s/g,'');
    if (USUARIOS[user]) { s.usuario = user; s.estado = 'esperando_pass'; return '🔑 Ingresá tu *contraseña*:'; }
    return '❌ Usuario no encontrado. Intentá de nuevo:';
  }

  if (s.estado === 'esperando_pass') {
    const u = USUARIOS[s.usuario];
    if (msg === u.pass) {
      s.vendedor = u.vendedor; s.nombre = u.nombre; s.estado = 'menu';
      return menuPrincipal(u.nombre);
    }
    s.estado = 'inicio'; s.usuario = null;
    return '❌ Contraseña incorrecta. Escribí *hola* para intentar de nuevo.';
  }

  // Si no está logueado
  if (!s.vendedor) { s.estado = 'inicio'; return procesarMensaje(tel, texto); }

  // ── Cerrar sesión ──
  if (msg === '0' || msg === 'salir' || msg === 'logout') {
    const nombre = s.nombre;
    sesiones[tel] = { estado: 'inicio' };
    return `👋 Hasta luego, *${nombre}*! Sesión cerrada.`;
  }

  // ── Menu ──
  if (msg === 'menu' || msg === 'inicio') {
    s.estado = 'menu';
    return menuPrincipal(s.nombre);
  }

  // ── Búsqueda directa con nombre: "faltantes de X", "buscar X", "ver X" ──
  const matchNombre = texto.trim().match(/^(?:faltantes?\s+de|buscar?|ver|cliente|info\s+de)\s+(.+)$/i);
  if (matchNombre) {
    const q = matchNombre[1].trim().toUpperCase();
    const clientes = getClientesPorVendedor(s.vendedor);
    const res = clientes.filter(c =>
      c.razon.toUpperCase().includes(q) ||
      c.cod === q ||
      c.dir.toUpperCase().includes(q)
    );
    if (res.length === 0) return `❌ No encontré ningún cliente con "${matchNombre[1]}".\n\nEscribí *menu* para ver las opciones.`;
    if (res.length === 1) return fichaCliente(res[0]);
    let r = `🔍 Encontré *${res.length} clientes* con "${matchNombre[1]}":\n\n`;
    res.slice(0,8).forEach(c => { r += `• *${c.cod}* — ${c.razon} (${c.loc})\n`; });
    if (res.length > 8) r += `...y ${res.length-8} más.\n`;
    r += '\nEscribí el nombre completo o el código para ver el detalle.';
    return r;
  }

  // ── Opción 1: avance ──
  if (msg === '1' || msg.includes('avance') || msg.includes('objetivo')) {
    const av = getAvance(s.vendedor);
    if (!av) return '⚠️ No encontré datos de avance.';
    const falta = av.obj_total - av.av_total;
    return `📊 *${s.nombre} — Avance Marzo 2026*\n\n` +
      `📦 KG vendidos: *${kg(av.av_total)}*\n🎯 Objetivo: *${kg(av.obj_total)}*\n📈 Proyección: *${kg(av.proyeccion)}*\n✅ Avance: *${pct(av.pct_total)}*\n\n` +
      `*Por categoría:*\n🍔 Hamburguesas: ${pct(av.pct_hamb)} (${kg(av.av_hamb)}/${kg(av.obj_hamb)})\n` +
      `🌭 Salchichas: ${pct(av.pct_salch)} (${kg(av.av_salch)}/${kg(av.obj_salch)})\n` +
      `🍗 Rebozados: ${pct(av.pct_rebo)} (${kg(av.av_rebo)}/${kg(av.obj_rebo)})\n\n` +
      `💡 Te faltan *${kg(falta)}* para cumplir el objetivo.\n\nEscribí *menu* para volver.`;
  }

  // ── Opción 2: sin vender ──
  if (msg === '2' || msg.includes('sin vender')) {
    const sv = getSinVender(s.vendedor);
    if (!sv.length) return '✅ No tenés clientes sin vender esta semana.';
    const dias = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
    let r = `🚫 *Sin vender — ${s.nombre}*\nTotal: *${sv.length}*\n\n`;
    for (const dia of dias) {
      const g = sv.filter(c => c.dia && c.dia.toUpperCase() === dia);
      if (g.length) {
        r += `*${dia}* (${g.length}):\n`;
        g.slice(0,5).forEach(c => { r += `• ${c.razon} — ${c.loc}\n`; });
        if (g.length > 5) r += `  ...y ${g.length-5} más\n`;
        r += '\n';
      }
    }
    return r + 'Escribí *menu* para volver.';
  }

  // ── Opción 3: buscar (modo interactivo) ──
  if (msg === '3' || msg === 'buscar') {
    s.estado = 'buscando_cliente';
    return '🔍 ¿Qué cliente buscás?\nPodés ingresar nombre, código o dirección:';
  }
  if (s.estado === 'buscando_cliente') {
    const q = msg.toUpperCase();
    const clientes = getClientesPorVendedor(s.vendedor);
    const res = clientes.filter(c => c.razon.toUpperCase().includes(q) || c.cod.includes(q) || c.dir.toUpperCase().includes(q));
    s.estado = 'menu';
    if (!res.length) return `❌ No encontré clientes con "${texto}".\n\nEscribí *menu* para volver.`;
    if (res.length === 1) return fichaCliente(res[0]);
    let r = `🔍 *${res.length} resultados*:\n\n`;
    res.slice(0,8).forEach(c => { r += `• *${c.cod}* — ${c.razon} (${c.loc})\n`; });
    if (res.length > 8) r += `...y ${res.length-8} más.\n`;
    return r + '\nEscribí el nombre o código exacto para ver el detalle.';
  }

  // ── Opción 4: cluster ──
  if (msg === '4' || msg === 'cluster') {
    s.estado = 'buscando_cluster';
    const clientes = getClientesPorVendedor(s.vendedor);
    const clusters = [...new Set(clientes.map(c=>c.cluster).filter(Boolean))].sort();
    return `🏷️ *Tus clusters:*\n${clusters.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\nEscribí el nombre del cluster:`;
  }
  if (s.estado === 'buscando_cluster') {
    const q = msg.toUpperCase();
    const clientes = getClientesPorVendedor(s.vendedor);
    const res = clientes.filter(c => c.cluster.toUpperCase().includes(q));
    s.estado = 'menu';
    if (!res.length) return `❌ No encontré clientes en ese cluster.\n\nEscribí *menu* para volver.`;
    const totalKg = res.reduce((a,c)=>a+c.kg,0);
    let r = `🏷️ *${res[0].cluster}*\nTotal: *${res.length} clientes* | *${kg(totalKg)}*\n\n`;
    res.slice(0,10).forEach(c => { r += `• ${c.razon} — ${kg(c.kg)}\n`; });
    if (res.length > 10) r += `...y ${res.length-10} más.\n`;
    return r + '\nEscribí *menu* para volver.';
  }

  // ── Opción 5: todos los faltantes ──
  if (msg === '5' || msg === 'faltantes' || msg === 'faltante') {
    const clientes = getClientesPorVendedor(s.vendedor);
    const con = clientes.filter(c => c.faltante && c.faltante !== 'nan' && c.sku < 7);
    if (!con.length) return '✅ Todos tus clientes tienen la cartera completa.';
    let r = `📦 *Clientes con faltantes*\nTotal: *${con.length}*\n\n`;
    con.slice(0,10).forEach(c => { r += `• *${c.razon}*\n  ❌ ${c.faltante.replace(/\+/g,', ')}\n`; });
    if (con.length > 10) r += `\n...y ${con.length-10} más.`;
    return r + '\n\n💡 Para ver el detalle escribí:\n*faltantes de [nombre del cliente]*\n\nEscribí *menu* para volver.';
  }

  return `No entendí ese comando 🤔\n\n${menuPrincipal(s.nombre)}`;
}

// ─── WEBHOOK ──────────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const from = req.body.From || '';
  const body = req.body.Body || '';
  const tel  = from.replace('whatsapp:','');
  console.log(`📩 [${tel}]: ${body}`);
  const respuesta = procesarMensaje(tel, body);
  console.log(`📤 → ${respuesta.slice(0,80)}`);
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuesta);
  res.type('text/xml').send(twiml.toString());
});

cargarExcel();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot SuMi en puerto ${PORT}`));
