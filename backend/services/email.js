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
  let smtpPort = process.env.SMTP_PORT || process.env.EMAIL_PORT || 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || '').trim();
  const smtpFrom = (process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser || '').trim();

  if (!smtpHost || !smtpPort) {
    console.warn('⚠️  SMTP configuration not found (SMTP_HOST or SMTP_PORT missing). Email sending will be disabled.');
    return null;
  }

  if (!smtpUser || !smtpPass) {
    console.warn('⚠️  SMTP credentials not configured. Email sending will be disabled.', {
      hasUser: Boolean(smtpUser),
      hasPass: Boolean(smtpPass),
      hint: 'Set SMTP_USER and SMTP_PASS on the Cloud Run service (e.g. GCP Console → Cloud Run → service → Edit → Variables).'
    });
    return null;
  }

  // Fix incorrect port 5001 (should be 587 for Gmail TLS)
  if (smtpPort === '5001' || smtpPort === 5001) {
    console.warn('⚠️  SMTP_PORT 5001 is incorrect for Gmail. Using 587 (TLS) instead.');
    smtpPort = 587;
  }

  const portNumber = Number(smtpPort);
  const isSecure = smtpSecure || portNumber === 465;

  console.log('📧 Creating SMTP transporter:', {
    host: smtpHost,
    port: portNumber,
    secure: isSecure,
    user: smtpUser,
    from: smtpFrom
  });

  return nodemailer.createTransport({
    host: smtpHost,
    port: portNumber,
    secure: isSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false
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

    // Determine the public admin URL:
    // - Prefer ADMIN_FRONTEND_URL when set (explicit public admin domain)
    // - Otherwise use ADMIN_URL (Cloud Run or domain)
    // - Fallback to localhost for local development.
    // IMPORTANT:
    // - Always use ADMIN_FRONTEND_URL (public admin domain for this environment)
    // - Fallback to ADMIN_URL only if ADMIN_FRONTEND_URL is not set
    // - Never derive from the backend host, because multiple admin frontends
    //   can share the same API service.
    let baseAdminUrl =
      process.env.ADMIN_FRONTEND_URL ||
      process.env.ADMIN_URL ||
      'http://localhost:3001';
    // Strip trailing slashes
    baseAdminUrl = baseAdminUrl.replace(/\/+$/, '');
    const inviteUrl = `${baseAdminUrl}/setup-password?token=${token}`;

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

/**
 * Send admin password reset email.
 * Reuses the setup-password page with a short-lived token.
 */
async function sendAdminPasswordReset(email, token, username) {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    let baseAdminUrl =
      process.env.ADMIN_FRONTEND_URL ||
      process.env.ADMIN_URL ||
      'http://localhost:3001';
    baseAdminUrl = baseAdminUrl.replace(/\/+$/, '');
    const resetUrl = `${baseAdminUrl}/setup-password?token=${token}`;

    const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"Dial A Drink Admin" <${smtpFrom}>`,
      to: email,
      subject: 'Reset your Dial A Drink Admin password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00E0B8;">Reset your Admin password</h2>
          <p>We received a request to reset the password for your Dial A Drink Admin account.</p>
          <p><strong>Username:</strong> ${username}</p>
          <p>Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #00E0B8; color: #0D0D0D; padding: 12px 24px;
                      text-decoration: none; border-radius: 4px; font-weight: bold;
                      display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #00E0B8; word-break: break-all;">${resetUrl}</a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This link will expire soon. If you didn’t request a password reset, you can ignore this email.
          </p>
        </div>
      `,
      text: `
Reset your Dial A Drink Admin password

Username: ${username}

Open this link to set a new password:
${resetUrl}

If you didn’t request this, you can ignore this email.
      `.trim()
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Admin password reset email sent to ${email}`);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`❌ Error sending admin password reset email to ${email}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send OTP via email
 * @param {string} email - Recipient email address
 * @param {string} otpCode - OTP code to send
 * @returns {Promise<Object>} Result of email sending
 */
async function sendOtpEmail(email, otpCode) {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"Dial A Drink Kenya" <${smtpFrom}>`,
      to: email,
      subject: 'Your Login OTP - Dial A Drink Kenya',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00E0B8;">Your Login OTP</h2>
          <p>Your OTP code for Dial A Drink Kenya login is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f5f5f5; border: 2px solid #00E0B8; padding: 20px; 
                        border-radius: 8px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; color: #00E0B8; letter-spacing: 8px; 
                           font-family: 'Courier New', monospace;">
                ${otpCode}
              </span>
            </div>
          </div>
          <p style="color: #666; font-size: 14px;">
            Enter this code to verify your login. This code will expire in 3 hours.
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            If you didn't request this OTP, please ignore this email.
          </p>
        </div>
      `,
      text: `
        Your Login OTP - Dial A Drink Kenya
        
        Your OTP code is: ${otpCode}
        
        Enter this code to verify your login. This code will expire in 3 hours.
        
        If you didn't request this OTP, please ignore this email.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ OTP email sent to ${email}`);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`❌ Error sending OTP email to ${email}:`, error);
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
  sendAdminInvite,
  sendAdminPasswordReset,
  sendOtpEmail
};

