 /**
 * @file mail.js
 * @description Shared Nodemailer transporter factory. Extracted from
 * kanboard.controller.js and discord.controller.js, which both had an
 * identical copy — admin.controller.js is a third consumer.
 *
 * Required env:
 * MAIL_SMTP_HOSTNAME / MAIL_SMTP_PORT / MAIL_FROM, plus
 * MAIL_SMTP_USERNAME / MAIL_SMTP_PASSWORD when the server wants credentials.
 *
 * In development, point it at a local catcher so nothing is really sent:
 *   npm run maildev        # SMTP on 1025, inbox at http://localhost:1080
 * and leave the username and password blank.
 */

"use strict";

require("dotenv").config();
const nodemailer = require("nodemailer");

function getMailTransporter() {
  const user = process.env.MAIL_SMTP_USERNAME;
  const port = parseInt(process.env.MAIL_SMTP_PORT || "587", 10);

  return nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOSTNAME,
    port,
    // 465 is the implicit-TLS port; everything else starts plain and upgrades.
    secure: port === 465,
    // A local catcher (Mailpit, MailDev) has no accounts. Offering credentials
    // it does not want makes it refuse the connection, so they are only sent
    // when there is a username to send.
    ...(user ? { auth: { user, pass: process.env.MAIL_SMTP_PASSWORD } } : {}),
    ...(user ? {} : { ignoreTLS: true }),
  });
}

/**
 * Whether the mail server can be reached and would accept a message. Used to
 * warn before adding someone, so a misconfigured server is noticed then rather
 * than after the account exists.
 */
async function verifyMail() {
  if (!process.env.MAIL_SMTP_HOSTNAME) {
    return { ok: false, reason: "No mail server is configured (MAIL_SMTP_HOSTNAME is empty)." };
  }
  try {
    await getMailTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { getMailTransporter, verifyMail };
