import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import ndaStandardMap from '../lib/pdf/templates/ndaMap.js'

// -----------------------------
// SUPABASE CLIENT
// -----------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// -----------------------------
// DRAW FIELD HELPER
// -----------------------------
function drawField(page, font, value, config) {
  if (!value) return

  page.drawText(String(value), {
    x: config.x,
    y: config.y,
    size: config.size || 10,
    font
  })
}

// -----------------------------
// GENERATE PDF
// -----------------------------
async function generatePdf(order) {
  try {
    console.log('📄 Generating PDF for order:', order.order_id)

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const data = order.intake_data || {}

    // Fill fields from map
    for (const key in ndaStandardMap.fields) {
      const config = ndaStandardMap.fields[key]
      const value = data[key]
      drawField(page, font, value, config)
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save()

    // 🔥 CRITICAL FIX: Convert to Buffer
    const fileBuffer = Buffer.from(pdfBytes)

    console.log('✅ PDF generated, size:', fileBuffer.length)

    return fileBuffer

  } catch (err) {
    console.error('❌ PDF GENERATION ERROR:', err)
    throw err
  }
}

// -----------------------------
// UPLOAD TO SUPABASE STORAGE
// -----------------------------
async function uploadPdf(order, fileBuffer) {
  try {
    const fileName = `${order.order_id}.pdf`

    console.log('☁️ Uploading:', fileName)

    const { error } = await supabase.storage
      .from('documents')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (error) {
      console.error('❌ UPLOAD ERROR:', error)
      throw error
    }

    console.log('✅ Upload successful')

    return `documents/${fileName}`

  } catch (err) {
    console.error('❌ STORAGE ERROR:', err)
    throw err
  }
}

// -----------------------------
// MAIN HANDLER
// -----------------------------
export default async function handler(req, res) {
  try {
    console.log('🚀 Fulfillment started')

    // 1. Get orders ready for fulfillment
    const { data: orders, error } = await supabase
      .from('pweb_orders')
      .select('*')
      .eq('order_status', 'intake_complete')
      .eq('payment_status', 'paid')
      .limit(5)

    if (error) {
      console.error('❌ FETCH ORDERS ERROR:', error)
      throw error
    }

    if (!orders || orders.length === 0) {
      console.log('⚠️ No orders found')
      return res.status(200).json({
        message: 'No orders found'
      })
    }

    console.log(`📦 Found ${orders.length} orders`)

    const results = []

    // 2. Process each order
    for (const order of orders) {
      try {
        console.log('---------------------------')
        console.log('Processing order:', order.order_id)

        // Generate PDF
        const fileBuffer = await generatePdf(order)

        // Upload PDF
        const filePath = await uploadPdf(order, fileBuffer)

        // Update order
        const { error: updateError } = await supabase
          .from('pweb_orders')
          .update({
            order_status: 'document_created',
            document_path: filePath
          })
          .eq('order_id', order.order_id)

        if (updateError) {
          console.error('❌ UPDATE ERROR:', updateError)
          throw updateError
        }

        console.log('✅ Order completed:', order.order_id)

        results.push({
          order_id: order.order_id,
          status: 'success'
        })

      } catch (err) {
        console.error('❌ ORDER FAILED:', order.order_id, err)

        results.push({
          order_id: order.order_id,
          status: 'failed',
          error: err.message
        })
      }
    }

    // 3. Return results
    return res.status(200).json({
      message: 'Fulfillment complete 🚀',
      results
    })

  } catch (err) {
    console.error('🔥 FATAL ERROR:', err)

    return res.status(500).json({
      error: err.message,
      stack: err.stack
    })
  }
}
