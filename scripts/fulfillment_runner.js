/**
 * Fulfillment Runner - FINAL (STRICT pweb_orders VERSION)
 * Built ONLY from Drew's schema
 */

import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ndaStandardMap } from '../lib/pdf/templates/nda-standard-map.js';

// ----------------------------------------------
// SUPABASE
// ----------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ----------------------------------------------
// GET ORDERS (STRICT TO YOUR FLOW)
// ----------------------------------------------
async function getOrdersToFulfill() {
  const { data, error } = await supabase
    .from('pweb_orders')
    .select('*')
    .eq('payment_status', 'paid')
    .eq('order_status', 'intake_complete');

  if (error) throw error;
  return data;
}

// ----------------------------------------------
// TRANSLATE YOUR DB → TEMPLATE MAP
// ----------------------------------------------
function mapOrderToTemplate(order) {
  return {
    // Dates
    effective_date: new Date(order.created_at).toLocaleDateString(),

    // Parties
    disclosing_party_name: order.party1_name || '',
    disclosing_party_state: order.client_state || '',

    receiving_party_name: order.party2_name || '',
    receiving_party_state: order.client_state || '',

    // Core content
    purpose: order.details || '',

    // Terms
    confidentiality_term_years: '3', // default (we can upgrade later)

    governing_state: order.governing_state || '',

    // Signatures
    disclosing_sign_name: order.party1_name || '',
    disclosing_sign_title: order.party1_role || '',

    receiving_sign_name: order.party2_name || '',
    receiving_sign_title: order.party2_role || '',
  };
}

// ----------------------------------------------
// DRAW TEXT
// ----------------------------------------------
function drawField(page, font, text, config) {
  if (!text) return;

  page.drawText(String(text), {
    x: config.x,
    y: config.y,
    size: config.size || 11,
    font,
    color: rgb(0, 0, 0),
    maxWidth: config.maxWidth || 200,
  });
}

// ----------------------------------------------
// CREATE DOCUMENT
// ----------------------------------------------
async function createDocument(order) {
  console.log(`📄 Creating PDF for ${order.order_id}`);

  if (order.doc_type !== 'nda') {
    console.log(`⚠️ Skipping unsupported doc_type: ${order.doc_type}`);
    return null;
  }

  const data = mapOrderToTemplate(order);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([
    ndaStandardMap.page.width,
    ndaStandardMap.page.height
  ]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ----------------------------------------------
  // TITLE
  // ----------------------------------------------
  if (ndaStandardMap.static?.title) {
    page.drawText(ndaStandardMap.static.title.text, {
      x: ndaStandardMap.static.title.x,
      y: ndaStandardMap.static.title.y,
      size: ndaStandardMap.static.title.size,
      font: boldFont,
    });
  }

  // ----------------------------------------------
  // FIELDS
  // ----------------------------------------------
  for (const key in ndaStandardMap.fields) {
    const config = ndaStandardMap.fields[key];
    const value = data[key];

    drawField(page, font, value, config);
  }

  // ----------------------------------------------
  // SAVE PDF
  // ----------------------------------------------
  const pdfBytes = await pdfDoc.save();
  const fileName = `${order.order_id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const pdfPath = `documents/${fileName}`;

  console.log(`✅ PDF saved: ${pdfPath}`);

  return {
    pdf_path: pdfPath
  };
}

// ----------------------------------------------
// UPDATE ORDER
// ----------------------------------------------
async function markReady(orderId, paths) {
  if (!paths) return;

  const { error } = await supabase
    .from('pweb_orders')
    .update({
      order_status: 'document_created',
      pdf_path: paths.pdf_path,
    })
    .eq('order_id', orderId);

  if (error) throw error;
}

// ----------------------------------------------
// RUNNER
// ----------------------------------------------
async function run() {
  try {
    console.log('🚀 Running fulfillment (pweb_orders ONLY)...');

    const orders = await getOrdersToFulfill();

    if (!orders.length) {
      console.log('⚠️ No eligible orders found');
      return;
    }

    for (const order of orders) {
      const paths = await createDocument(order);
      await markReady(order.order_id, paths);
    }

    console.log('🎉 DONE — PDFs GENERATED');
  } catch (err) {
    console.error('❌ ERROR:', err);
  }
}

run();
