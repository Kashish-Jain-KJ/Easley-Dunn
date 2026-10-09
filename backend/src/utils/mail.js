 /**
 * @file mail.js
 * @description Shared Nodemailer transporter factory. Extracted from
 * kanboard.controller.js and discord.controller.js, which both had an
 * identical copy — admin.controller.js is a third consumer.
 *
 * Required env:
 * MAIL_SMTP_HOSTNAME / MAIL_SMTP_PORT / MAIL_SMTP_USERNAME / MAIL_SMTP_PASSWORD / MAIL_FROM
 */

"use strict";

require("dotenv").config();
const nodemailer = require("nodemailer");

function getMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOSTNAME,
    port: parseInt(process.env.MAIL_SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.MAIL_SMTP_USERNAME,
      pass: process.env.MAIL_SMTP_PASSWORD,
    },
  });
}

module.exports = { getMailTransporter };
