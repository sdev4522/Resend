function recoverEmail(appName, recoveryLink) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Recovery</title>
        <style>
            /* Email Body */
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 0;
            }
            /* Email Wrapper */
            .email-wrapper {
                max-width: 600px;
                margin: auto;
                padding: 20px;
            }
            /* Email Header */
            .email-header {
                text-align: center;
                margin-bottom: 20px;
            }
            /* Email Content */
            .email-content {
                padding: 20px;
                background-color: #f9f9f9;
                border-radius: 8px;
            }
            /* Button Style */
            .button {
                display: inline-block;
                background-color: #007bff;
                color: #ffffff;
                text-decoration: none;
                padding: 10px 20px;
                border-radius: 5px;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-header">
                <h1>Password Recovery</h1>
            </div>
            <div class="email-content">
                <p>Hello,</p>
                <p>You have requested to reset your password. Please click the button below to reset it:</p>
                <a href="${recoveryLink}" class="button">Reset Password</a>
                <p>If you did not request this, you can safely ignore this email.</p>
                <p>Thank you,</p>
                <p>${appName}</p>
            </div>
        </div>
    </body>
    </html>
    `
}

function verificationOtpEmail(appName, otpCode) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Verification Code</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 0;
                background-color: #f4f4f5;
                color: #18181b;
            }
            .email-wrapper {
                max-width: 520px;
                margin: 40px auto;
                padding: 24px;
            }
            .email-card {
                background: #ffffff;
                border-radius: 12px;
                border: 1px solid #e4e4e7;
                padding: 32px 28px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            }
            .brand-name {
                font-size: 20px;
                font-weight: 700;
                color: #059669;
                margin-bottom: 24px;
            }
            h1 {
                font-size: 22px;
                font-weight: 700;
                margin: 0 0 12px 0;
                color: #09090b;
            }
            p {
                font-size: 14px;
                color: #71717a;
                margin: 0 0 20px 0;
            }
            .otp-box {
                background: #f0fdf4;
                border: 2px dashed #059669;
                border-radius: 10px;
                padding: 16px 24px;
                display: inline-block;
                margin: 16px 0 24px 0;
            }
            .otp-code {
                font-family: 'Courier New', Courier, monospace;
                font-size: 32px;
                font-weight: 800;
                letter-spacing: 8px;
                color: #047857;
            }
            .footer-text {
                font-size: 12px;
                color: #a1a1aa;
                margin-top: 24px;
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-card">
                <div class="brand-name">${appName || 'WaCRM'}</div>
                <h1>Verify Your Email</h1>
                <p>Use the 6-digit verification code below to complete your registration and activate your workspace:</p>
                <div class="otp-box">
                    <span class="otp-code">${otpCode}</span>
                </div>
                <p>This code will expire in <strong>30 minutes</strong>. If you did not create an account, you can safely ignore this email.</p>
                <div class="footer-text">
                    &copy; ${new Date().getFullYear()} ${appName || 'WaCRM'}. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

module.exports = { recoverEmail, verificationOtpEmail };