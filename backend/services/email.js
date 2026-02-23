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

/**
 * Send partner invitation email for sandbox account
 * @param {string} email - Recipient email address
 * @param {string} token - Invitation token
 * @param {string} partnerName - Partner/company name
 * @param {string} apiKey - Sandbox API key
 * @returns {Promise<Object>} Result of email sending
 */
async function sendPartnerInvite(email, token, partnerName, apiKey) {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    // Determine partner console URL based on environment
    const hostname = process.env.PARTNER_CONSOLE_URL || 'http://localhost:3002';
    const inviteUrl = `${hostname}/setup-password?token=${token}`;

    // Use SMTP_FROM from dial-a-drink project configuration
    const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"Wolfgang - DeliveryOS" <${smtpFrom}>`,
      to: email,
      subject: 'Welcome to DeliveryOS Valkyrie - Sandbox Account Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #A22C29 0%, #902923 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to DeliveryOS Valkyrie</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your sandbox account has been created</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Hello,
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Your sandbox account for <strong>${partnerName}</strong> has been successfully created!
            </p>
            
            <div style="background: white; border-left: 4px solid #A22C29; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin: 0 0 15px 0; color: #A22C29;">Your Sandbox API Key</h3>
              <p style="margin: 0 0 10px 0; font-family: 'Courier New', monospace; background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
                ${apiKey}
              </p>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">
                ⚠️ Store this API key securely. You can regenerate it from the Partner Console.
              </p>
            </div>
            
            <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 4px; border: 1px solid #e0e0e0;">
              <h3 style="margin: 0 0 15px 0; color: #333;">Access Your Partner Console</h3>
              <p style="margin: 0 0 20px 0; color: #666;">
                Click the button below to set your password and access your partner console:
              </p>
              <div style="text-align: center;">
                <a href="${inviteUrl}" 
                   style="background-color: #A22C29; color: white; padding: 14px 28px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold; 
                          display: inline-block;">
                  Set Password & Access Console
                </a>
              </div>
              <p style="margin: 20px 0 0 0; color: #666; font-size: 12px;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: #A22C29; word-break: break-all;">${inviteUrl}</a>
              </p>
            </div>
            
            <div style="background: #FFF3CD; border: 1px solid #FFC107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Important:</strong> This invitation link will expire in 7 days. If you didn't request this account, please ignore this email.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Need help? Visit our <a href="https://thewolfgang.tech/developers-docs.html" style="color: #A22C29;">documentation</a> or contact support.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Wolfgang - DeliveryOS Valkyrie API</p>
          </div>
        </div>
      `,
      text: `
        Welcome to DeliveryOS Valkyrie
        
        Your sandbox account for ${partnerName} has been successfully created!
        
        Your Sandbox API Key:
        ${apiKey}
        
        ⚠️ Store this API key securely. You can regenerate it from the Partner Console.
        
        Access Your Partner Console:
        Click the link below to set your password and access your partner console:
        ${inviteUrl}
        
        This invitation link will expire in 7 days.
        
        Need help? Visit our documentation at https://thewolfgang.tech/developers-docs.html
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Partner invite email sent to ${email}`);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`❌ Error sending partner invite email to ${email}:`, error);
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message,
      details: {
        code: error.code,
        command: error.command,
        response: error.response
      }
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
  sendPartnerInvite,
  sendOtpEmail
};

