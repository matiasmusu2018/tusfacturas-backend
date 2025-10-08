// server.js - Versión completa: Factura A (con cálculos y campos necesarios)
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

console.log('🚀 Servidor TusFacturas - PRODUCCIÓN');
console.log('📄 API v2: developers.tusfacturas.app');

// Storage en memoria
let templatesGuardados = [];
let clientesGuardados = [];

const createBaseRequest = () => ({
  apikey: API_KEY,
  apitoken: API_TOKEN,
  usertoken: USER_TOKEN
});

// FORMATO DD/MM/YYYY
const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// redondeo a 2 decimales (Number)
const round2 = (n) => Number(Number(n || 0).toFixed(2));

// ENDPOINTS BÁSICOS
app.get('/', (req, res) => {
  res.json({
    message: 'TusFacturas API - SILVIA MONICA NAHABETIAN',
    status: 'OK',
    timestamp: new Date().toISOString(),
    cuit: '27233141246',
    pdv: '00006',
    modo: 'PRODUCCIÓN',
    clientes_locales: clientesGuardados.length,
    templates_guardados: templatesGuardados.length
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// GESTIÓN CLIENTES
app.get('/api/clientes', (req, res) => {
  console.log(`📋 Devolviendo ${clientesGuardados.length} clientes locales`);
  res.json(clientesGuardados);
});

app.post('/api/clientes/agregar', (req, res) => {
  try {
    const { cliente } = req.body;
    const nuevoId = clientesGuardados.length > 0 ? Math.max(...clientesGuardados.map(c => c.id)) + 1 : 1;
    const clienteNuevo = {
      id: nuevoId,
      nombre: cliente.nombre,
      documento: (cliente.documento || '').replace(/-/g, ''),
      email: cliente.email || '',
      tipo_documento: 'CUIT',
      origen: 'manual'
    };
    const existe = clientesGuardados.find(c => c.documento === clienteNuevo.documento);
    if (existe) return res.json({ success: true, message: 'Cliente ya existe', cliente: existe });
    clientesGuardados.push(clienteNuevo);
    console.log(`➕ Cliente agregado: ${clienteNuevo.nombre} (${clienteNuevo.documento})`);
    res.json({ success: true, cliente: clienteNuevo });
  } catch (err) {
    console.error('Error agregando cliente:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/clientes/guardar', (req, res) => {
  try {
    const { clientes } = req.body;
    clientesGuardados = clientes || [];
    console.log(`💾 ${clientesGuardados.length} clientes guardados`);
    res.json({ success: true, total: clientesGuardados.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GESTIÓN TEMPLATES
app.get('/api/templates', (req, res) => {
  res.json(templatesGuardados);
});

app.post('/api/templates/guardar', (req, res) => {
  try {
    const { templates } = req.body;
    templatesGuardados = templates || [];
    console.log(`💾 ${templatesGuardados.length} templates guardados`);
    res.json({ success: true, total: templatesGuardados.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UTIL: calcular vencimiento según condicion_pago (si es '0' -> contado -> misma fecha)
const calcularVencimiento = (fechaBase, condicionPago) => {
  const v = new Date(fechaBase);
  const dias = parseInt(condicionPago, 10);
  if (!isNaN(dias) && dias > 0) v.setDate(v.getDate() + dias);
  return v;
};

// ENVÍO DE FACTURAS - FACTURA A (con todos los campos necesarios)
app.post('/api/enviar-facturas', async (req, res) => {
  const { templates } = req.body;
  const templatesSeleccionados = (templates || []).filter(t => t.selected);
  const resultados = [];

  console.log(`\n🚀 Enviando ${templatesSeleccionados.length} facturas (Factura A)`);

  try {
    for (const template of templatesSeleccionados) {
      try {
        const cliente = clientesGuardados.find(c => c.id === template.clienteId);
        if (!cliente) throw new Error(`Cliente ID ${template.clienteId} no encontrado`);

        console.log(`\n🧾 Preparando factura para: ${cliente.nombre} - CUIT: ${cliente.documento}`);

        // Valores por template (si no vienen, usamos defaults)
        const cantidadItem = Number(template.cantidad || 1);
        const precioUnitarioSinIva = Number(template.monto || template.precio || 0); // asume monto = precio sin IVA
        const alicuota = Number(template.alicuota ?? 21); // porcentaje
        const bonificacionPorcentaje = Number(template.bonificacion_porcentaje ?? 0); // % general
        const condicionPago = String(template.condicion_pago ?? cliente.condicion_pago ?? '0'); // '0' contado
        const percepciones = Array.isArray(template.percepciones) ? template.percepciones : []; // [{tipo:'IIBB', importe: X}, ...]

        // Fecha y vencimiento
        const fechaHoy = new Date();
        const fechaVto = calcularVencimiento(fechaHoy, condicionPago);

        // Cálculo por item (soporta varios items si vienen en template.items)
        const items = Array.isArray(template.items) && template.items.length > 0
          ? template.items.map(it => ({
              cantidad: Number(it.cantidad || 1),
              precio_unitario_sin_iva: Number(it.precio || it.precio_unitario_sin_iva || 0),
              alicuota: Number(it.alicuota ?? alicuota),
              descripcion: it.descripcion || template.concepto || 'Servicio'
            }))
          : [{
              cantidad: cantidadItem,
              precio_unitario_sin_iva: precioUnitarioSinIva,
              alicuota,
              descripcion: template.concepto || 'Servicio'
            }];

        // Subtotales e IVA
        let importe_neto_gravado = 0;
        let importe_exento = 0;
        let importe_no_gravado = 0;
        let importe_iva = 0;
        let impuestos_internos = 0; // dejamos 0 por defecto, se puede extender
        const detalleParaAPI = [];

        for (const it of items) {
          const lineaSubtotal = round2(it.precio_unitario_sin_iva * Number(it.cantidad));
          // aquí consideramos que si alicuota === 0 es exento
          if (it.alicuota === 0) {
            importe_exento += lineaSubtotal;
          } else {
            importe_neto_gravado += lineaSubtotal;
            const ivaLinea = round2(lineaSubtotal * (it.alicuota / 100));
            importe_iva += ivaLinea;
          }

          detalleParaAPI.push({
            cantidad: String(it.cantidad),
            afecta_stock: 'N',
            bonificacion_porcentaje: '0',
            producto: {
              descripcion: it.descripcion,
              unidad_bulto: '1',
              lista_precios: 'SERVICIOS',
              codigo: '',
              precio_unitario_sin_iva: it.precio_unitario_sin_iva.toFixed(2),
              alicuota: String(it.alicuota),
              unidad_medida: '7',
              actualiza_precio: 'N',
              rg5329: 'N'
            },
            leyenda: ''
          });
        }

        // Bonificación (aplicada sobre neto gravado)
        const bonificacionVal = round2(importe_neto_gravado * (bonificacionPorcentaje / 100));
        importe_neto_gravado = round2(importe_neto_gravado - bonificacionVal);

        // Percepciones (sumarlas si vienen)
        let percepcionesTotal = 0;
        const percepcionesParaAPI = [];
        for (const p of percepciones) {
          const imp = round2(Number(p.importe || 0));
          if (imp > 0) {
            percepcionesTotal += imp;
            percepcionesParaAPI.push({
              tipo: p.tipo || 'PER',
              descripcion: p.descripcion || p.tipo || 'Percepción',
              importe: imp.toFixed(2)
            });
          }
        }

        // Totales finales
        importe_neto_gravado = round2(importe_neto_gravado);
        importe_exento = round2(importe_exento);
        importe_no_gravado = round2(importe_no_gravado);
        importe_iva = round2(importe_iva);
        impuestos_internos = round2(impuestos_internos);
        percepcionesTotal = round2(percepcionesTotal);

        const total = round2(importe_neto_gravado + importe_exento + importe_no_gravado + importe_iva + impuestos_internos + percepcionesTotal);

        // Validación mínima: total > 0
        if (total <= 0) {
          throw new Error('El total calculado es 0. Revise precios/cantidades del template.');
        }

        // Construir comprobante completo (Factura A)
        const facturaData = {
          ...createBaseRequest(),
          cliente: {
            documento_tipo: 'CUIT',
            documento_nro: cliente.documento,
            razon_social: cliente.nombre,
            email: cliente.email || '',
            domicilio: cliente.domicilio || 'Ciudad Autónoma de Buenos Aires',
            provincia: cliente.provincia || '1', // CABA
            envia_por_mail: cliente.email ? 'S' : 'N',
            condicion_iva: 'RI',
            condicion_pago: condicionPago
          },
          comprobante: {
            fecha: formatDate(fechaHoy),
            vencimiento: formatDate(fechaVto),
            tipo: 'FACTURA A',
            operacion: 'V',
            punto_venta: String(process.env.PUNTO_VENTA || '6'),
            moneda: 'PES',
            cotizacion: '1',
            idioma: '1',
            periodo_facturado_desde: formatDate(fechaHoy),
            periodo_facturado_hasta: formatDate(fechaHoy),
            rubro: template.rubro || 'Servicios Profesionales',
            rubro_grupo_contable: template.rubro_grupo_contable || 'servicios',
            detalle: detalleParaAPI,
            bonificacion: bonificacionVal.toFixed(2),
            // DESGLOSES RECOMENDADOS por API/AFIP
            importe_neto_gravado: importe_neto_gravado.toFixed(2),
            importe_exento: importe_exento.toFixed(2),
            importe_no_gravado: importe_no_gravado.toFixed(2),
            importe_iva: importe_iva.toFixed(2),
            impuestos_internos: impuestos_internos.toFixed(2),
            percepciones: percepcionesParaAPI.length > 0 ? percepcionesParaAPI : undefined,
            total: total.toFixed(2),
            leyenda_gral: template.leyenda_gral || ''
          }
        };

        console.log('   📤 REQUEST A TUSFACTURAS (resumen):');
        console.log(`   Fecha: ${facturaData.comprobante.fecha}  Vto: ${facturaData.comprobante.vencimiento}`);
        console.log(`   Neto: ${facturaData.comprobante.importe_neto_gravado}  IVA: ${facturaData.comprobante.importe_iva}  Total: ${facturaData.comprobante.total}`);
        console.log('   Detalle items:', facturaData.comprobante.detalle.length);

        // Envío
        const response = await axios.post(
          `${TUSFACTURAS_BASE_URL}/facturacion/nuevo`,
          facturaData,
          {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        // Log respuesta cruda
        console.log('   📥 Respuesta API:', JSON.stringify(response.data, null, 2));

        if (response.data?.error === 'S') {
          const apiErr = Array.isArray(response.data.errores) ? response.data.errores.join(' | ') : (response.data.errores || 'Error API');
          throw new Error(apiErr);
        }

        // Éxito
        resultados.push({
          templateId: template.id,
          success: true,
          facturaNumero: response.data.numero,
          cliente: cliente.nombre,
          cae: response.data.cae,
          vencimiento_cae: response.data.vencimiento_cae,
          pdf_url: response.data.pdf_url
        });

        // Pausa para no saturar (si hay varias)
        await new Promise(r => setTimeout(r, 1200));

      } catch (err) {
        // Mejor detalle de error
        console.error('   ❌ ERROR AL ENVIAR FACTURA:', err.message);
        console.error('   Detalle API:', err.response?.data || 'sin response.data');
        resultados.push({
          templateId: template.id,
          success: false,
          error: err.response?.data?.errores?.[0] || err.message
        });
      }
    }

    const exitosas = resultados.filter(r => r.success).length;
    const fallidas = resultados.filter(r => !r.success).length;

    console.log(`\n✅ Resultado: ${exitosas} exitosas | ${fallidas} fallidas`);

    // Desmarcar las exitosas en templatesGuardados (si usás memoria local)
    if (exitosas > 0) {
      templatesGuardados = templatesGuardados.map(t => {
        const ok = resultados.find(r => r.templateId === t.id && r.success);
        return ok ? { ...t, selected: false } : t;
      });
    }

    res.json({ success: true, total: templatesSeleccionados.length, exitosas, fallidas, detalles: resultados });

  } catch (err) {
    console.error('💥 ERROR CRÍTICO EN ENVIOS:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// TEST conexión (buscar)
app.get('/api/test', async (req, res) => {
  try {
    const response = await axios.post(
      `${TUSFACTURAS_BASE_URL}/facturacion/buscar`,
      {
        ...createBaseRequest(),
        fecha_desde: formatDate(new Date()),
        fecha_hasta: formatDate(new Date())
      },
      { timeout: 10000 }
    );
    console.log('🔍 Test API OK');
    res.json({ success: true, mensaje: 'Conexión exitosa con TusFacturas', modo: 'PRODUCCIÓN', api: response.data });
  } catch (err) {
    console.error('❌ Error de conexión test:', err.message);
    res.status(500).json({ success: false, error: err.message, detail: err.response?.data });
  }
});

// Handlers y arranque
app.use((error, req, res, next) => {
  console.error('🚨 Error no manejado:', error);
  res.status(500).json({ error: 'Error interno del servidor', message: error.message });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado', path: req.originalUrl });
});

const server = app.listen(PORT, () => {
  console.log(`\nServidor activo en puerto ${PORT} — MODO: PRODUCCIÓN\n`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => console.log('✅ Servidor cerrado correctamente'));
});

module.exports = app;
