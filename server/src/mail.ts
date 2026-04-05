import nodemailer from 'nodemailer'

export const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

export const sendTemporaryPasswordEmail = async (
  to: string,
  tempPassword: string,
): Promise<{ sent: boolean; error?: string }> => {
  if (!isSmtpConfigured()) {
    return { sent: false, error: 'SMTP yapılandırılmadı' }
  }
  const port = Number(process.env.SMTP_PORT) || 587
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'noreply@studysprint.local'
  try {
    await transporter.sendMail({
      from,
      to,
      subject: 'StudySprint — geçici şifreniz',
      text: [
        'Merhaba,',
        '',
        'Şifre sıfırlama talebiniz için geçici şifreniz:',
        tempPassword,
        '',
        'Güvenliğiniz için giriş yaptıktan hemen sonra şifrenizi değiştirin.',
        '',
        'StudySprint',
      ].join('\n'),
      html: `<p>Merhaba,</p>
<p>Şifre sıfırlama talebiniz için <strong>geçici şifreniz</strong>:</p>
<p style="font-size:18px;font-family:monospace">${tempPassword}</p>
<p>Güvenliğiniz için giriş yaptıktan hemen sonra şifrenizi değiştirin.</p>
<p>StudySprint</p>`,
    })
    return { sent: true }
  } catch (e) {
    console.error('[mail]', e)
    return { sent: false, error: 'E-posta gönderilemedi' }
  }
}
