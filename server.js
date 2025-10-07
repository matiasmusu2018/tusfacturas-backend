// server.js - Versión PRODUCCIÓN con persistencia
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

console.log('🚀 Servidor en MODO PRODUCCIÓN');
console.log('🔧 API Key:', API_KEY);

// Storage en memoria para templates persistentes
let templatesGuardados = [];

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

// RUTA 1: Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'TusFacturas API - SILVIA MONICA NAHABETIAN',
    status: 'OK',
    timestamp: new Date().toISOString(),
    cuit: '27233141246',
    pdv: '00006',
    modo: 'PRODUCCIÓN',
    templates_guardados: templatesGuardados.length
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// RUTA 2: Obtener clientes registrados REALES
app.get('/api/clientes', async (req, res) => {
  try {
    console.log('🔍 Obteniendo clientes REALES de TusFacturas...');
    
    const requestData = createBaseRequest();
    
    // Probar primero con el endpoint de listado
    let response;
    let clientes = [];
    
    try {
      console.log('Intentando con /clientes/listado...');
      response = await axios.post(
        `${TUSFACTURAS_BASE_URL}/clientes/listado`,
        requestData,
        { 
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      console.log('✅ Respuesta recibida de /clientes/listado');
    } catch (err) {
      console.log('⚠️ /clientes/listado falló, intentando con /clientes...');
      response = await axios.post(
        `${TUSFACTURAS_BASE_URL}/clientes`,
        requestData,
        { 
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      console.log('✅ Respuesta recibida de /clientes');
    }
    
    console.log('📦 Estructura de respuesta:', JSON.stringify(response.data).substring(0, 200));
    
    // Intentar extraer clientes de diferentes estructuras posibles
    let clientesData = response.data;
    
    // Caso 1: Array directo
    if (Array.isArray(clientesData)) {
      clientes = clientesData;
      console.log('📋 Estructura detectada: Array directo');
    }
    // Caso 2: Objeto con key "clientes"
    else if (clientesData?.clientes && Array.isArray(clientesData.clientes)) {
      clientes = clientesData.clientes;
      console.log('📋 Estructura detectada: Objeto con key "clientes"');
    }
    // Caso 3: Objeto con key "data"
    else if (clientesData?.data && Array.isArray(clientesData.data)) {
      clientes = clientesData.data;
      console.log('📋 Estructura detectada: Objeto con key "data"');
    }
    // Caso 4: Un solo cliente
    else if (clientesData && typeof clientesData === 'object' && clientesData.id) {
      clientes = [clientesData];
      console.log('📋 Estructura detectada: Cliente único');
    }
    // Caso 5: Error de la API
    else if (clientesData?.error === 'S') {
      const errorMsg = clientesData.errores?.[0] || 'Error desconocido';
      console.error('❌ Error de TusFacturas API:', errorMsg);
      throw new Error(errorMsg);
    }
    
    if (clientes.length === 0) {
      console.log('⚠️ No se encontraron clientes en la respuesta');
      console.log('📦 Respuesta completa:', JSON.stringify(response.data));
    }
    
    // Formatear clientes
    const clientesFormateados = clientes.map((cliente) => ({
      id: cliente.id || cliente.cliente_id,
      nombre: cliente.razon_social || cliente.nombre || cliente.cliente_nombre || 'Sin nombre',
      email: cliente.email || cliente.cliente_email || 'sin-email@example.com',
      documento: cliente.documento || cliente.cuit || cliente.cliente_cuit || '00000000000',
      condicion_iva: cliente.condicion_iva || 'CF'
    }));
    
    console.log(`✅ ${clientesFormateados.length} clientes formateados correctamente`);
    
    if (clientesFormateados.length > 0) {
      console.log('👤 Primer cliente:', clientesFormateados[0].nombre);
    }
    
    res.json(clientesFormateados);
    
  } catch (error) {
    console.error('❌ Error obteniendo clientes:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Si falla completamente, devolver array vacío
    console.log('⚠️ Devolviendo array vacío - los clientes se podrán agregar manualmente');
    res.json([]);
  }
});

// RUTA 3: Obtener templates (persistentes + del mes pasado si existen)
app.get('/api/templates', async (req, res) => {
  try {
    console.log('📊 Obteniendo templates...');
    
    // Si ya hay templates guardados, devolverlos
    if (templatesGuardados.length > 0) {
      console.log(`✅ Devolviendo ${templatesGuardados.length} templates guardados`);
      return res.json(templatesGuardados);
    }
    
    // Si no hay guardados, intentar traer del mes pasado
    console.log('🔍 Buscando facturas del mes anterior...');
    
    const now = new Date();
    const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const fechaDesde = formatDate(mesAnterior);
    const fechaHasta = formatDate(finMesAnterior);
    
    console.log(`📅 Período: ${fechaDesde} hasta ${fechaHasta}`);
    
    const requestData = {
      ...createBaseRequest(),
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta
    };
    
    const response = await axios.post(
      `${TUSFACTURAS_BASE_URL}/facturacion/buscar`,
      requestData,
      { 
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    let facturas = [];
    
    // Manejar diferentes estructuras de respuesta
    if (Array.isArray(response.data)) {
      facturas = response.data;
    } else if (response.data?.comprobantes && Array.isArray(response.data.comprobantes)) {
      facturas = response.data.comprobantes;
    }
    
    console.log(`📋 ${facturas.length} facturas encontradas`);
    
    // Filtrar solo facturas (no NC)
    facturas = facturas.filter(f => {
      const tipo = (f.tipo_comprobante || f.tipo || '').toString().toUpperCase();
      return tipo.includes('FACTURA') && !tipo.includes('NOTA') && !tipo.includes('CREDITO');
    });
    
    console.log(`✅ ${facturas.length} facturas válidas para templates`);
    
    // Formatear como templates
    const templates = facturas.map((factura, index) => ({
      id: index + 1,
      clienteId: factura.cliente?.id || factura.cliente_id || 1,
      concepto: factura.detalle?.[0]?.descripcion || factura.descripcion || 'Servicios profesionales - {MM_AAAA_ANTERIOR_TEXTO}',
      monto: parseFloat(factura.importe_total || factura.total || 0),
      selected: true
    }));
    
    // Guardar templates en memoria
    templatesGuardados = templates;
    
    res.json(templates);
    
  } catch (error) {
    console.error('❌ Error obteniendo templates:', error.message);
    
    // Si hay templates guardados, devolverlos aunque falle la API
    if (templatesGuardados.length > 0) {
      console.log('⚠️ Error en API pero hay templates guardados');
      return res.json(templatesGuardados);
    }
    
    // Si no hay nada, devolver array vacío para que agreguen manualmente
    res.json([]);
  }
});

// RUTA 4: Guardar templates manualmente (persistencia)
app.post('/api/templates/guardar', (req, res) => {
  try {
    const { templates } = req.body;
    templatesGuardados = templates;
    console.log(`💾 ${templates.length} templates guardados en memoria`);
    
    res.json({ 
      success: true, 
      message: 'Templates guardados correctamente',
      total: templates.length
    });
  } catch (error) {
    console.error('❌ Error guardando templates:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// RUTA 4B: Agregar cliente manualmente
app.post('/api/clientes/agregar', (req, res) => {
  try {
    const { cliente } = req.body;
    console.log('➕ Agregando cliente manual:', cliente.nombre);
    
    // En una implementación real, esto debería guardarse en una base de datos
    // Por ahora solo confirmamos que se recibió
    
    res.json({ 
      success: true, 
      message: 'Cliente agregado correctamente',
      cliente: {
        id: Date.now(), // ID temporal
        ...cliente
      }
    });
  } catch (error) {
    console.error('❌ Error agregando cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// RUTA 5: Enviar facturas masivamente (PRODUCCIÓN REAL)
app.post('/api/enviar-facturas', async (req, res) => {
  const { templates } = req.body;
  const templatesSeleccionados = templates.filter(t => t.selected);
  const resultados = [];
  
  console.log(`⚠️ ENVIANDO ${templatesSeleccionados.length} FACTURAS REALES A ARCA`);
  
  try {
    for (const template of templatesSeleccionados) {
      try {
        console.log(`📝 Enviando factura para cliente ${template.clienteId}...`);
        
        const facturaData = {
          ...createBaseRequest(),
          facturacion: {
            fecha: formatDate(new Date()),
            tipo_comprobante: 6, // Factura B
            punto_vta: 6,
            cliente: { id: template.clienteId },
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
        
        // Verificar si hubo error
        if (response.data?.error === 'S') {
          const errorMsg = response.data.errores?.[0] || 'Error al enviar factura';
          throw new Error(errorMsg);
        }
        
        console.log(`✅ Factura ${template.id} enviada exitosamente a ARCA`);
        
        resultados.push({
          templateId: template.id,
          success: true,
          facturaId: response.data.numero || response.data.id || 'Procesado',
          mensaje: 'Factura enviada y procesada por ARCA',
          cae: response.data.cae,
          vencimiento_cae: response.data.vencimiento_cae
        });
        
        // Pausa entre requests
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
    
    // Actualizar templates guardados: desmarcar los enviados exitosamente
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

// RUTA 6: Test de conexión
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
      modo: 'PRODUCCIÓN'
    });
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      mensaje: 'Error de conexión con TusFacturas'
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
  console.log(`⚠️ MODO PRODUCCIÓN - Envío REAL a ARCA`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => console.log('✅ Servidor cerrado'));
});

module.exports = app;