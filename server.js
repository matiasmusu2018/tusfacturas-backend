// server.js - VERSIÓN CON MATCHING REAL DE CLIENTES
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['https://tusfacturasapp.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Configuración de TusFacturas API v2
const TUSFACTURAS_BASE_URL = 'https://www.tusfacturas.app/app/api/v2';
const API_KEY = process.env.API_KEY || '68567';
const API_TOKEN = process.env.TUSFACTURAS_API_TOKEN || '6aa4e9bbe67eb7d8a05b28ea378ef55f';
const USER_TOKEN = process.env.USER_TOKEN || 'd527102f84b9a161f7f6ccbee824834610035e0a4a56c07c94f7afa4d0545244';

console.log('🚀 Servidor en MODO PRODUCCIÓN con MATCHING REAL');

// Storage persistente con IDs REALES de TusFacturas
let templatesGuardados = [];
let clientesGuardados = []; // Ahora guardará { id: ID_REAL_TUSFACTURAS, nombre, email, documento }

// Función helper para crear request base
const createBaseRequest = () => ({
  apikey: API_KEY,
  apitoken: API_TOKEN,
  usertoken: USER_TOKEN
});

// Función helper para formatear fechas
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 🔍 NUEVA FUNCIÓN: Buscar cliente en TusFacturas por CUIT
async function buscarClientePorCuit(cuit) {
  try {
    console.log(`🔍 Buscando cliente con CUIT: ${cuit}`);
    
    const requestData = {
      ...createBaseRequest(),
      documento: cuit
    };
    
    const response = await axios.post(
      `${TUSFACTURAS_BASE_URL}/clientes/consultar`,
      requestData,
      { 
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data && response.data.id) {
      console.log(`✅ Cliente encontrado - ID: ${response.data.id}`);
      return {
        id: response.data.id,
        nombre: response.data.razon_social,
        email: response.data.email,
        documento: response.data.documento
      };
    }
    
    return null;
    
  } catch (error) {
    console.log(`⚠️ Cliente no encontrado con CUIT ${cuit}`);
    return null;
  }
}

// 🆕 NUEVA FUNCIÓN: Crear cliente en TusFacturas
async function crearClienteEnTusFacturas(cliente) {
  try {
    console.log(`➕ Creando cliente en TusFacturas: ${cliente.nombre}`);
    
    const requestData = {
      ...createBaseRequest(),
      cliente: {
        razon_social: cliente.nombre,
        documento: cliente.documento,
        email: cliente.email || 'sin-email@example.com',
        condicion_iva: 'CF', // Consumidor Final por defecto
        domicilio: 'Sin especificar',
        provincia: 1
      }
    };
    
    const response = await axios.post(
      `${TUSFACTURAS_BASE_URL}/clientes/alta`,
      requestData,
      { 
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data && response.data.id) {
      console.log(`✅ Cliente creado - ID: ${response.data.id}`);
      return {
        id: response.data.id,
        nombre: response.data.razon_social,
        email: response.data.email,
        documento: response.data.documento
      };
    }
    
    throw new Error('No se pudo crear el cliente');
    
  } catch (error) {
    console.error('❌ Error creando cliente:', error.response?.data || error.message);
    throw error;
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'TusFacturas API - SILVIA MONICA NAHABETIAN',
    status: 'OK',
    timestamp: new Date().toISOString(),
    cuit: '27233141246',
    pdv: '00006',
    modo: 'PRODUCCIÓN CON MATCHING REAL',
    templates_guardados: templatesGuardados.length,
    clientes_guardados: clientesGuardados.length
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// RUTA: Obtener clientes guardados
app.get('/api/clientes', (req, res) => {
  console.log(`📋 Devolviendo ${clientesGuardados.length} clientes guardados`);
  res.json(clientesGuardados);
});

// RUTA: Obtener templates
app.get('/api/templates', (req, res) => {
  console.log(`📊 Devolviendo ${templatesGuardados.length} templates guardados`);
  res.json(templatesGuardados);
});

// RUTA: Guardar templates
app.post('/api/templates/guardar', (req, res) => {
  try {
    const { templates } = req.body;
    templatesGuardados = templates;
    console.log(`💾 ${templates.length} templates guardados`);
    
    res.json({ 
      success: true, 
      message: 'Templates guardados correctamente',
      total: templates.length
    });
  } catch (error) {
    console.error('❌ Error guardando templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// RUTA: Guardar clientes
app.post('/api/clientes/guardar', (req, res) => {
  try {
    const { clientes } = req.body;
    clientesGuardados = clientes;
    console.log(`💾 ${clientes.length} clientes guardados`);
    
    res.json({ 
      success: true, 
      message: 'Clientes guardados correctamente',
      total: clientes.length
    });
  } catch (error) {
    console.error('❌ Error guardando clientes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🆕 RUTA MEJORADA: Agregar cliente con matching real
app.post('/api/clientes/agregar', async (req, res) => {
  try {
    const { cliente } = req.body;
    console.log('➕ Procesando nuevo cliente:', cliente.nombre);
    
    // 1. Buscar si ya existe en TusFacturas
    let clienteReal = await buscarClientePorCuit(cliente.documento);
    
    if (clienteReal) {
      console.log(`✅ Cliente encontrado en TusFacturas - ID: ${clienteReal.id}`);
    } else {
      // 2. Si no existe, crearlo
      console.log('⚠️ Cliente no existe, creando en TusFacturas...');
      clienteReal = await crearClienteEnTusFacturas(cliente);
    }
    
    // 3. Guardar en nuestra lista con el ID REAL
    const clienteExistente = clientesGuardados.find(c => c.id === clienteReal.id);
    
    if (!clienteExistente) {
      clientesGuardados.push(clienteReal);
      console.log(`💾 Cliente agregado a la lista local - Total: ${clientesGuardados.length}`);
    } else {
      console.log('ℹ️ Cliente ya estaba en la lista local');
    }
    
    res.json({ 
      success: true, 
      message: clienteReal ? 'Cliente encontrado y asociado' : 'Cliente creado correctamente',
      cliente: clienteReal
    });
    
  } catch (error) {
    console.error('❌ Error procesando cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      detalle: error.response?.data
    });
  }
});

// RUTA MEJORADA: Enviar facturas con IDs REALES
app.post('/api/enviar-facturas', async (req, res) => {
  const { templates } = req.body;
  const templatesSeleccionados = templates.filter(t => t.selected);
  const resultados = [];
  
  console.log(`📤 ENVIANDO ${templatesSeleccionados.length} FACTURAS REALES A ARCA`);
  
  try {
    for (const template of templatesSeleccionados) {
      try {
        // Verificar que el clienteId sea REAL de TusFacturas
        const clienteReal = clientesGuardados.find(c => c.id === template.clienteId);
        
        if (!clienteReal) {
          throw new Error(`Cliente ID ${template.clienteId} no encontrado en la lista`);
        }
        
        console.log(`📝 Enviando factura para: ${clienteReal.nombre} (ID: ${clienteReal.id})`);
        
        const facturaData = {
          ...createBaseRequest(),
          facturacion: {
            fecha: formatDate(new Date()),
            tipo_comprobante: 6, // Factura B
            punto_vta: 6,
            cliente: { 
              id: clienteReal.id // ✅ ID REAL de TusFacturas
            },
            detalle: [{
              descripcion: template.concepto,
              cantidad: 1,
              precio_unitario: template.monto,
              alicuota_iva: 21.00
            }]
          }
        };
        
        const response = await axios.post(
          `${TUSFACTURAS_BASE_URL}/facturacion/nuevo`,
          facturaData,
          { 
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        if (response.data?.error === 'S') {
          const errorMsg = response.data.errores?.[0] || 'Error al enviar factura';
          throw new Error(errorMsg);
        }
        
        console.log(`✅ Factura enviada exitosamente - Cliente: ${clienteReal.nombre}`);
        
        resultados.push({
          templateId: template.id,
          success: true,
          facturaId: response.data.numero || response.data.id,
          cliente: clienteReal.nombre,
          mensaje: 'Factura enviada y procesada por ARCA',
          cae: response.data.cae,
          vencimiento_cae: response.data.vencimiento_cae
        });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (error) {
        console.error(`❌ Error enviando factura ${template.id}:`, error.message);
        resultados.push({
          templateId: template.id,
          success: false,
          error: error.response?.data?.errores?.[0] || error.message
        });
      }
    }
    
    const exitosas = resultados.filter(r => r.success).length;
    const fallidas = resultados.filter(r => !r.success).length;
    
    console.log(`🎯 Envío completado: ${exitosas} exitosas, ${fallidas} fallidas`);
    
    // Desmarcar exitosas
    templatesGuardados = templatesGuardados.map(t => {
      const resultado = resultados.find(r => r.templateId === t.id && r.success);
      return resultado ? { ...t, selected: false } : t;
    });
    
    res.json({
      success: true,
      total: templatesSeleccionados.length,
      exitosas,
      fallidas,
      detalles: resultados
    });
    
  } catch (error) {
    console.error('💥 Error crítico:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// Test de conexión
app.get('/api/test', async (req, res) => {
  try {
    console.log('🔍 Test de conexión con TusFacturas...');
    
    const requestData = createBaseRequest();
    
    const response = await axios.post(
      `${TUSFACTURAS_BASE_URL}/clientes/listado`,
      requestData,
      { 
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    console.log('✅ Conexión exitosa con TusFacturas');
    
    res.json({
      success: true,
      mensaje: 'Conexión exitosa con TusFacturas',
      modo: 'PRODUCCIÓN CON MATCHING REAL'
    });
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handlers
app.use((error, req, res, next) => {
  console.error('🚨 Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: error.message
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`👤 CUIT: 27233141246 - PDV: 00006`);
  console.log(`✅ MODO: PRODUCCIÓN con MATCHING REAL de clientes`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => console.log('✅ Servidor cerrado'));
});

module.exports = app;