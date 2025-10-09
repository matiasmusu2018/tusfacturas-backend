// server.js - Versión con persistencia en JSONBin
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://tusfacturasapp.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

const TUSFACTURAS_BASE_URL = 'https://www.tusfacturas.app/app/api/v2';
const API_KEY = process.env.API_KEY || '68567';
const API_TOKEN = process.env.TUSFACTURAS_API_TOKEN || '6aa4e9bbe67eb7d8a05b28ea378ef55f';
const USER_TOKEN = process.env.USER_TOKEN || 'd527102f84b9a161f7f6ccbee824834610035e0a4a56c07c94f7afa4d0545244';

const JSONBIN_KEY = process.env.JSONBIN_KEY;
const CLIENTES_BIN_ID = process.env.JSONBIN_CLIENTES_BIN;
const TEMPLATES_BIN_ID = process.env.JSONBIN_TEMPLATES_BIN;

console.log('🚀 Servidor TusFacturas - PRODUCCIÓN CON PERSISTENCIA JSONBin');

// ----------------------------------
// Funciones de persistencia JSONBin
// ----------------------------------

const leerJSONBin = async (binId, valorDefault = []) => {
  try {
    const res = await axios.get(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    const datos = res.data.record;
    if (!Array.isArray(datos)) return valorDefault;
    if (datos.length === 1 && datos[0]._init) return valorDefault;
    return datos;
  } catch (err) {
    console.error('❌ Error leyendo JSONBin:', err.message);
    return valorDefault;
  }
};

const guardarJSONBin = async (binId, datos) => {
  try {
    await axios.put(`https://api.jsonbin.io/v3/b/${binId}`, datos, {
      headers: {
        'X-Master-Key': JSONBIN_KEY,
        'Content-Type': 'application/json'
      }
    });
    return true;
  } catch (err) {
    console.error('❌ Error guardando JSONBin:', err.message);
    return false;
  }
};

// Variables globales
let clientesGuardados = [];
let templatesGuardados = [];

// Inicializar datos al iniciar
const initData = async () => {
  clientesGuardados = await leerJSONBin(CLIENTES_BIN_ID, []);
  templatesGuardados = await leerJSONBin(TEMPLATES_BIN_ID, []);
  console.log(`✅ Datos cargados desde JSONBin: ${clientesGuardados.length} clientes, ${templatesGuardados.length} templates`);
};
initData();

// ----------------------------------
// Utilidades
// ----------------------------------

const createBaseRequest = () => ({
  apikey: API_KEY,
  apitoken: API_TOKEN,
  usertoken: USER_TOKEN
});

const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const calcularVencimiento = (fechaBase, condicionPago) => {
  const v = new Date(fechaBase);
  const dias = parseInt(condicionPago, 10);
  if (!isNaN(dias) && dias > 0) v.setDate(v.getDate() + dias);
  return v;
};

// ----------------------------------
// Endpoints básicos
// ----------------------------------

app.get('/', (req, res) => {
  res.json({
    message: 'TusFacturas API - SILVIA MONICA NAHABETIAN',
    status: 'OK',
    timestamp: new Date().toISOString(),
    cuit: '27233141246',
    pdv: '00006',
    modo: 'PRODUCCIÓN CON PERSISTENCIA JSONBin',
    clientes_locales: clientesGuardados.length,
    templates_guardados: templatesGuardados.length
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    persistencia: (CLIENTES_BIN_ID && TEMPLATES_BIN_ID) ? 'OK' : 'ERROR'
  });
});

// ----------------------------------
// Gestión de clientes
// ----------------------------------

app.get('/api/clientes', async (req, res) => {
  clientesGuardados = await leerJSONBin(CLIENTES_BIN_ID, []);
  res.json(clientesGuardados);
});

app.post('/api/clientes/agregar', async (req, res) => {
  try {
    const { cliente } = req.body;
    
    clientesGuardados = await leerJSONBin(CLIENTES_BIN_ID, []);
    
    const nuevoId = clientesGuardados.length > 0 
      ? Math.max(...clientesGuardados.map(c => c.id)) + 1 
      : 1;
    
    const clienteNuevo = {
      id: nuevoId,
      nombre: cliente.nombre,
      documento: (cliente.documento || '').replace(/-/g, ''),
      email: cliente.email || '',
      tipo_documento: 'CUIT',
      origen: 'manual',
      fecha_creacion: new Date().toISOString()
    };
    
    const existe = clientesGuardados.find(c => c.documento === clienteNuevo.documento);
    if (existe) return res.json({ success: true, message: 'Cliente ya existe', cliente: existe });
    
    clientesGuardados.push(clienteNuevo);
    await guardarJSONBin(CLIENTES_BIN_ID, clientesGuardados);
    
    res.json({ success: true, cliente: clienteNuevo });
  } catch (err) {
    console.error('❌ Error agregando cliente:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/clientes/guardar', async (req, res) => {
  try {
    const { clientes } = req.body;
    clientesGuardados = clientes || [];
    await guardarJSONBin(CLIENTES_BIN_ID, clientesGuardados);
    res.json({ success: true, total: clientesGuardados.length });
  } catch (err) {
    console.error('❌ Error guardando clientes:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------
// Gestión de templates
// ----------------------------------

app.get('/api/templates', async (req, res) => {
  templatesGuardados = await leerJSONBin(TEMPLATES_BIN_ID, []);
  res.json(templatesGuardados);
});

app.post('/api/templates/guardar', async (req, res) => {
  try {
    const { templates } = req.body;
    templatesGuardados = templates || [];
    await guardarJSONBin(TEMPLATES_BIN_ID, templatesGuardados);
    res.json({ success: true, total: templatesGuardados.length });
  } catch (err) {
    console.error('❌ Error guardando templates:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------
// Endpoints de facturación y envío de facturas
// ----------------------------------

// Aquí mantenés exactamente tu lógica de /api/enviar-facturas
// Solo cambiando lectura y guardado de templates usando JSONBin
// Ejemplo de guardado de templates exitosos:
const guardarTemplatesExitosos = async () => {
  await guardarJSONBin(TEMPLATES_BIN_ID, templatesGuardados);
};

// ----------------------------------
// Inicio del servidor
// ----------------------------------

const server = app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT} - Persistencia JSONBin`);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando servidor...');
  await guardarJSONBin(CLIENTES_BIN_ID, clientesGuardados);
  await guardarJSONBin(TEMPLATES_BIN_ID, templatesGuardados);
  server.close(() => console.log('✅ Servidor cerrado correctamente'));
});

module.exports = app;
