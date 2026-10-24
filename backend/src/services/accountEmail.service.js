/**
 * @file accountEmail.service.js
 * @description The two emails that carry a one-time link: the invite to a new
 * account, and a password reset.
 *
 * Neither carries a password. A password in a mailbox outlives its usefulness,
 * cannot be revoked, and tends to end up in logs and backups. A link expires,
 * works once, and the person chooses their own password at the end of it.
 *
 * Both are laid out the same way — who it is from, what it is for, one action,
 * the same link in plain sight, when it expires, and what to do if it was not
 * expected — which is the shape Okta and Google use. Both parts of each message
 * carry the full text: a client showing the plain-text alternative must not be
 * left holding a bare URL.
 */

"use strict";

const { getMailTransporter } = require("../utils/mail");
const logger = require("../utils/logger");
const inviteTokens = require("../repositories/inviteTokens.repo");
const auditEvents = require("../repositories/auditEvents.repo");

function appUrl() {
  return process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")[0].trim()
    : "http://localhost:3000";
}

function greet(user) {
  return user.first_name ? `Hi ${user.first_name},` : "Hi,";
}

/**
 * The shared layout. `lines` is the body as plain-text lines; `blocks` is the
 * same body as HTML paragraphs. Keeping them side by side here is what stops
 * the two versions drifting apart.
 */
function compose({ user, subject, lines, blocks, link, action, button, expiry, closing }) {
  const signIn = appUrl();

  const text = [
    greet(user),
    "",
    ...lines,
    "",
    `Username: ${user.email}`,
    "",
    `${action}:`,
    link,
    "",
    `The link can only be used once and expires in ${expiry}.`,
    `You can sign in at ${signIn}.`,
    "",
    closing,
    "",
    "Easley-Dunn Cerberus",
  ].join("\n");

  return {
    from: process.env.MAIL_FROM || process.env.MAIL_SMTP_USERNAME,
    to: user.email,
    subject,
    text,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 560px; color: #1e293b; line-height: 1.55;">
        <p style="font-size: 15px;">${greet(user)}</p>
        ${blocks.map((b) => `<p style="font-size: 15px;">${b}</p>`).join("\n        ")}
        <p style="font-size: 15px; margin-bottom: 6px;"><strong>Username:</strong> ${user.email}</p>
        <p style="font-size: 15px;">${action}:</p>
        <p style="margin: 18px 0;">
          <a href="${link}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 11px 20px; border-radius: 6px; font-weight: 600; display: inline-block;">
            ${button}
          </a>
        </p>
        <p style="font-size: 13px; color: #475569; word-break: break-all;">
          Or paste this into your browser:<br />
          <a href="${link}" style="color: #2563eb;">${link}</a>
        </p>
        <p style="font-size: 13px; color: #475569;">
          The link can only be used once and expires in ${expiry}.
          You can sign in at <a href="${signIn}" style="color: #2563eb;">${signIn}</a>.
        </p>
        <p style="font-size: 13px; color: #475569;">${closing}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 22px 0 12px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Easley-Dunn Cerberus Access Management</p>
      </div>
    `,
  };
}

async function deliver(mail, who) {
  try {
    await getMailTransporter().sendMail(mail);
    return { sent: true };
  } catch (err) {
    // The account and the token still exist; the caller is told the mail did
    // not go out so it can be re-sent or the link passed on another way.
    logger.error(`[accountEmail] Could not email ${who}: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

/**
 * @param {Object} params
 * @param {Object} params.user       { user_id, email, first_name }
 * @param {string|null} [params.teamName]  named in the email when they were added to one
 * @param {number} params.actorUserId
 * @returns {Promise<{sent: boolean, link: string, expiresAt: Date, error?: string}>}
 */
async function sendInvite({ user, teamName = null, actorUserId }) {
  const { token, expiresAt } = await inviteTokens.issue(user.user_id, "INVITE");
  const link = `${appUrl()}/invite/${token}`;
  const joined = teamName ? ` You have been added to the ${teamName} team.` : "";

  const mail = compose({
    user,
    subject: "You have been invited to Easley-Dunn Cerberus",
    lines: [
      "You have been invited to the Easley-Dunn Cerberus access console, where your",
      `access to the lab's tools is managed.${joined}`,
    ],
    blocks: [
      `You have been invited to the Easley-Dunn Cerberus access console, where your access to the lab's tools is managed.${joined}`,
    ],
    link,
    action: "Use this link to choose a password and finish setting up your account",
    button: "Set up your account",
    expiry: inviteTokens.TTL.INVITE.label,
    closing:
      "If you were not expecting this, you can ignore this email. Any questions, speak to your administrator.",
  });

  const { sent, error } = await deliver(mail, user.email);

  await auditEvents.record({
    actorUserId,
    action: "INVITE_SENT",
    outcome: sent ? "SUCCESS" : "FAILED",
    targetUserId: user.user_id,
    detail: {
      ...(teamName ? { team: teamName } : {}),
      expiresAt,
      ...(error ? { reason: `Email failed: ${error}` } : {}),
    },
  });

  return { sent, link, expiresAt, error };
}

/**
 * Emails a password-reset link.
 *
 * The actor is the account itself: nobody else asked for this, and recording an
 * admin as the actor would be a lie in the log. A request for an address that
 * has no account never reaches here — see requestPasswordReset.
 *
 * @param {Object} params
 * @param {Object} params.user  { user_id, email, first_name }
 * @returns {Promise<{sent: boolean, link: string, expiresAt: Date, error?: string}>}
 */
async function sendPasswordReset({ user }) {
  const { token, expiresAt } = await inviteTokens.issue(user.user_id, "PASSWORD_RESET");
  const link = `${appUrl()}/reset/${token}`;

  const mail = compose({
    user,
    subject: "Reset your Easley-Dunn Cerberus password",
    lines: ["Someone asked to reset the password for your Easley-Dunn Cerberus account."],
    blocks: ["Someone asked to reset the password for your Easley-Dunn Cerberus account."],
    link,
    action: "If it was you, use this link to choose a new password",
    button: "Choose a new password",
    expiry: inviteTokens.TTL.PASSWORD_RESET.label,
    closing:
      "If it was not you, ignore this email. Your password has not changed and nothing else is needed.",
  });

  const { sent, error } = await deliver(mail, user.email);

  await auditEvents.record({
    actorUserId: user.user_id,
    targetUserId: user.user_id,
    action: "PASSWORD_RESET_REQUESTED",
    outcome: sent ? "SUCCESS" : "FAILED",
    detail: { expiresAt, ...(error ? { reason: `Email failed: ${error}` } : {}) },
  });

  return { sent, link, expiresAt, error };
}

module.exports = { sendInvite, sendPasswordReset };
