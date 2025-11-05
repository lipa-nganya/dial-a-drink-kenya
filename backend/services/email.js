const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Generate a secure random token for email confirmation
 */
function generateEmailToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create email transporter (using SMTP settings from timelog project)
 */
function createTransporter() {
  // Use SMTP environment variables (matching timelog project format)
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT || process.env.EMAIL_PORT || 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser;

  if (!smtpHost || !smtpPort) {
    console.warn('⚠️  SMTP configuration not found. Email sending will be disabled.');
    return null;
  }

  if (!smtpUser || !smtpPass) {
    console.warn('⚠️  SMTP credentials not configured. Email sending will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: smtpSecure || Number(smtpPort) === 465, // Use SMTP_SECURE or default based on port
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

/**
 * Send email confirmation link
 * @param {string} email - Recipient email address
 * @param {string} token - Confirmation token
 * @returns {Promise<Object>} Result of email sending
 */
async function sendEmailConfirmation(email, token) {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const confirmationUrl = `${baseUrl}/verify-email?token=${token}`;

    const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"Dial A Drink Kenya" <${smtpFrom}>`,
      to: email,
      subject: 'Confirm Your Login - Dial A Drink Kenya',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00E0B8;">Welcome to Dial A Drink Kenya</h2>
          <p>Click the button below to confirm your login and access your orders:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmationUrl}" 
               style="background-color: #00E0B8; color: #0D0D0D; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; font-weight: bold; 
                      display: inline-block;">
              Confirm Login
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Or copy and paste this link into your browser:<br>
            <a href="${confirmationUrl}" style="color: #00E0B8; word-break: break-all;">${confirmationUrl}</a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This link will expire in 3 hours. If you didn't request this login, please ignore this email.
          </p>
        </div>
      `,
      text: `
        Welcome to Dial A Drink Kenya
        
        Click the link below to confirm your login:
        ${confirmationUrl}
        
        This link will expire in 3 hours.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email confirmation sent to ${email}`);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`❌ Error sending email to ${email}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send admin invite email
 * @param {string} email - Recipient email address
 * @param {string} token - Invite token
 * @param {string} username - Username for the invite
 * @returns {Promise<Object>} Result of email sending
 */
async function sendAdminInvite(email, token, username) {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    const adminUrl = process.env.ADMIN_URL || 'http://localhost:3001';
    const inviteUrl = `${adminUrl}/setup-password?token=${token}`;

    const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"Dial A Drink Admin" <${smtpFrom}>`,
      to: email,
      subject: 'You\'ve been invited to Dial A Drink Admin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00E0B8;">Welcome to Dial A Drink Admin</h2>
          <p>You've been invited to join the Dial A Drink admin team!</p>
          <p><strong>Username:</strong> ${username}</p>
          <p>Click the button below to set your password and get started:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #00E0B8; color: #0D0D0D; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; font-weight: bold; 
                      display: inline-block;">
              Set Password
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Or copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #00E0B8; word-break: break-all;">${inviteUrl}</a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This link will expire in 7 days. If you didn't expect this invitation, please ignore this email.
          </p>
        </div>
      `,
      text: `
        Welcome to Dial A Drink Admin
        
        You've been invited to join the admin team!
        Username: ${username}
        
        Click the link below to set your password:
        ${inviteUrl}
        
        This link will expire in 7 days.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Admin invite email sent to ${email}`);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`❌ Error sending invite email to ${email}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendEmailConfirmation,
  generateEmailToken,
  createTransporter,
  sendAdminInvite
};

