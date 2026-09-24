/**
 * @file roleEmail.service.js
 * @description Email notification service triggered when a user's role is granted or updated.
 */

"use strict";

const { getMailTransporter } = require("../utils/mail");
const { ROLES } = require("../config/roles.config");

/**
 * Sends a role notification email to a user.
 * @param {Object} params
 * @param {string} params.toEmail
 * @param {string} params.role
 * @param {string} [params.grantedBy]
 * @returns {Promise<boolean>}
 */
async function sendRoleNotificationEmail({ toEmail, role, grantedBy }) {
  const fromEmail = process.env.MAIL_FROM || process.env.MAIL_SMTP_USERNAME;
  const appUrl = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")[0].trim()
    : "http://localhost:3000";

  const transporter = getMailTransporter();

  const roleConfig = ROLES[role] || {};
  const roleDesc = roleConfig.description || role;

  const mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: `[Cerberus] You have been granted ${role} access`,
    text: `Hi,\n\nYou have been granted '${role}' access on the Easley-Dunn Cerberus Access Management system${
      grantedBy ? ` by ${grantedBy}` : ""
    }.\n\nRole Level: ${role}\nDescription: ${roleDesc}\n\nPlease click the link below to sign in with your email and password:\n${appUrl}\n\nBest regards,\nEasley-Dunn Cerberus Admin Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-top: 0;">Cerberus Access Granted</h2>
        <p style="font-size: 15px; color: #334155;">Hi,</p>
        <p style="font-size: 15px; color: #334155;">
          You have been granted <strong style="color: #2563eb;">${role}</strong> access on the Easley-Dunn Cerberus Access Management platform${
      grantedBy ? ` by <strong>${grantedBy}</strong>` : ""
    }.
        </p>
        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #0f172a;">Role details:</p>
          <p style="margin: 0; font-size: 14px; color: #475569;">• <strong>Role:</strong> ${role}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">• <strong>Description:</strong> ${roleDesc}</p>
        </div>
        <p style="font-size: 15px; color: #334155;">Click the button below to log into the Cerberus Console:</p>
        <p style="margin: 25px 0;">
          <a href="${appUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
            Sign in to Cerberus Console
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 25px 0 15px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Easley-Dunn Cerberus Access Management System</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error(`[RoleEmail] Failed to send role notification email to ${toEmail}:`, err.message);
    return false;
  }
}

module.exports = { sendRoleNotificationEmail };
