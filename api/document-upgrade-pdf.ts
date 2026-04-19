export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { order_id, html_path } = req.body || {};

    if (!order_id || !html_path) {
      return res.status(400).json({
        success: false,
        error: 'order_id and html_path are required',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Starter function reached successfully.',
      order_id,
      html_path,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
}
