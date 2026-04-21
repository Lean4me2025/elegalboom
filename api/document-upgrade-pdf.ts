import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

function wrapText(text: string, maxCharsPerLine = 95): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (!trimmed) {
      lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (candidate.length <= maxCharsPerLine) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    lines.push('');
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines;
}

function buildPdfFileName(htmlPath: string): string {
  if (htmlPath.toLowerCase().endsWith('.html')) {
    return htmlPath.replace(/\.html$/i, '.pdf');
  }
  return `${htmlPath}.pdf`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const source = req.method === 'GET' ? req.query : (req.body || {});
    const order_id = source.order_id;
    const html_path = source.html_path;

    if (!order_id || !html_path) {
      return res.status(400).json({
        success: false,
        error: 'order_id and html_path are required',
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const bucketName = 'documents';

    const { data: htmlBlob, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(html_path);

    if (downloadError || !htmlBlob) {
      return res.status(404).json({
        success: false,
        error: 'Could not download HTML from storage',
        details: downloadError?.message || null,
        bucket: bucketName,
        html_path,
      });
    }

    const htmlText = await htmlBlob.text();
    const plainText = htmlToPlainText(htmlText);

    if (!plainText) {
      return res.status(400).json({
        success: false,
        error: 'HTML converted to empty text; no PDF content to generate',
        html_path,
      });
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const fontSize = 11;
    const lineHeight = 15;
    const maxCharsPerLine = 95;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const pdfFileName = buildPdfFileName(html_path);

    page.drawText('e-legalboom.com', {
      x: margin,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    y -= 22;

    page.drawText(`Order ID: ${order_id}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 16;

    page.drawText(`Source HTML: ${html_path}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 24;

    const lines = wrapText(plainText, maxCharsPerLine);

    for (const line of lines) {
      if (y <= margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(pdfFileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({
        success: false,
        error: 'PDF created but failed to upload to storage',
        details: uploadError.message,
        pdf_path: pdfFileName,
      });
    }

    const { data: updateData, error: updateError } = await supabase
      .from('pweb_orders')
      .update({
        pdf_path: pdfFileName,
      })
      .eq('order_id', order_id)
      .select('id, order_id, pdf_path, docx_path')
      .limit(1);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: 'PDF uploaded, but failed to update pweb_orders.pdf_path',
        details: updateError.message,
        pdf_path: pdfFileName,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'PDF generated, uploaded, and pdf_path updated successfully',
      order_id,
      html_path,
      pdf_path: pdfFileName,
      updated_row: updateData?.[0] || null,
      text_preview: plainText.slice(0, 500),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
    });
  }
}
