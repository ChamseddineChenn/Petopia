const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.log('Email transporter error:', error);
  } else {
    console.log('Email transporter ready');
  }
});

/**
 * Send verification email
 * @param {string} email - User's email
 * @param {string} verificationToken - Verification token
 * @returns {Promise}
 */
const sendVerificationEmail = async (email, verificationToken) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify Your Petopia Account',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4DB6AC; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .header h1 { color: white; margin: 0; }
              .code-box {
                background-color: #f5f5f5;
                border: 2px dashed #4DB6AC;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
              }
              .code {
                font-size: 36px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #333;
                font-family: 'Courier New', monospace;
              }
              .footer { font-size: 12px; color: #999; margin-top: 20px; text-align: center; }
              .warning { color: #d9534f; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🐾 Welcome to Petopia!</h1>
              </div>
              
              <h2 style="text-align: center;">Verify Your Email Address</h2>
              <p style="text-align: center;">Thank you for signing up! Enter this verification code in the app to activate your account:</p>
              
              <div class="code-box">
                <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">Your verification code:</p>
                <div class="code">${verificationToken}</div>
              </div>
              
              <p style="text-align: center;"><strong>This code expires in 15 minutes.</strong></p>
              
              <p class="warning" style="text-align: center;">
                ⚠️ If you didn't sign up for this account, you can safely ignore this email.
              </p>
              
              <div class="footer">
                <p>© 2025 Petopia. All rights reserved.</p>
                <p>Do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Verification email sent to:', email);
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} resetToken - Reset token
 * @returns {Promise}
 */
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Reset Your Petopia Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f0f0f0; padding: 20px; text-align: center; }
              .button { 
                display: inline-block; 
                padding: 12px 30px; 
                background-color: #28a745; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px;
                margin: 20px 0;
              }
              .footer { font-size: 12px; color: #999; margin-top: 20px; text-align: center; }
              .warning { color: #d9534f; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              
              <p>We received a request to reset your password. Click the button below to create a new password.</p>
              
              <center>
                <a href="${resetLink}" class="button">Reset Password</a>
              </center>
              
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background-color: #f9f9f9; padding: 10px; border-radius: 3px;">
                ${resetLink}
              </p>
              
              <p><strong>This link expires in 1 hour.</strong></p>
              
              <p class="warning">
                ⚠️ If you didn't request a password reset, please ignore this email or contact support.
              </p>
              
              <div class="footer">
                <p>© 2026 Petopia. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
    return result;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  transporter,
};
