import Mailgen from "mailgen";
import Nodemailer from "nodemailer";

// Brevo HTTP API — plain HTTPS (port 443), so it works where hosts
// filter all SMTP egress (Railway free blocks 2525 and 587). Free
// 300/day, sender verified with just a Gmail address, no domain needed.
const sendViaBrevo = async (options, emailTextual, emailHtml) => {
   const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
         "api-key": process.env.BREVO_API_KEY,
         "Content-Type": "application/json",
         accept: "application/json",
      },
      body: JSON.stringify({
         sender: {
            name: process.env.BREVO_SENDER_NAME || "Course Companion",
            email: process.env.BREVO_SENDER_EMAIL,
         },
         to: [{ email: options.email }],
         subject: options.subject,
         htmlContent: emailHtml,
         textContent: emailTextual,
      }),
      signal: AbortSignal.timeout(15000),
   });
   if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Brevo rejected the send (${res.status}): ${body}`);
   }
};

const sendEmail = async (options) => {
   const mailGenerator = new Mailgen({
      theme: "default",
      product: {
         name: "Course Companion",
         link: process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:5173"
      }
   })

   const emailTextual = mailGenerator.generatePlaintext({ body: options.mailgenContent })
   const emailHtml = mailGenerator.generate({ body: options.mailgenContent })

   try {
      // Preferred path where SMTP is filtered — env-only switch.
      if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) {
         await sendViaBrevo(options, emailTextual, emailHtml);
         return;
      }

      // Generic SMTP_* names with MAILTRAP_* fallback, so switching
      // providers (Mailtrap sandbox ↔ Gmail) is env-only.
      const transporter = Nodemailer.createTransport({
         host: process.env.SMTP_HOST || process.env.MAILTRAP_SMTP_HOST,
         port: process.env.SMTP_PORT || process.env.MAILTRAP_SMTP_PORT,
         auth: {
            user: process.env.SMTP_USER || process.env.MAILTRAP_SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.MAILTRAP_SMTP_PASS
         },
         // Hosted sandboxes (Railway free) often filter/slow SMTP egress —
         // fail fast instead of hanging the request for minutes.
         connectionTimeout: 10000,
         greetingTimeout: 10000,
         socketTimeout: 15000,
      })

      const mail = {
         // Gmail only sends from the authenticated account — keep the
         // friendly display name, but the address must be yours.
         from: process.env.SMTP_FROM || "Course Companion <no-reply@course-companion.local>",
         to: options.email,
         subject: options.subject,
         text: emailTextual,
         html: emailHtml
      }

      await transporter.sendMail(mail);
   } catch (error) {
      console.error("❌ Email service failed", error);
   }
};

const emailVerificationMailgenContent = (username, verificationUrl) => {
   return {
      name: username,
      intro: "Welcome to our app ! We're very excited to have you on board.",
      action: {
         instructions: "To verify your email please click on the following button",
         button: {
            color: "#22BC66",
            text: "Verify Email",
            link: verificationUrl
         },
      },
      outro: "Need help, or have questions? Just reply to this email, we'd love to help."
   };
};

const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
   return {
      name: username,
      intro: "You have requested a password reset, click the button below to reset your password",
      action: {
         instructions: "To reset your password please click on the following button",
         button: {
            color: "#22BC66",
            text: "Reset Password",
            link: passwordResetUrl
         },
      },
      outro: "Need help, or have questions? Just reply to this email, we'd love to help."
   };
};

const answerApprovedMailgenContent = (username, question) => {
   return {
      name: username,
      intro: "Your question has been reviewed by a TA and the answer is ready.",
      table: {
         data: [
            {
               Question: question.length > 140 ? question.slice(0, 140) + "…" : question,
            }
         ]
      },
      action: {
         instructions: "Open your history to read the full answer",
         button: {
            color: "#22BC66",
            text: "View Answer",
            link: process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:5173"
         },
      },
      outro: "Keep the questions coming — that's what we're here for."
   };
};

export {
   emailVerificationMailgenContent,
   forgotPasswordMailgenContent,
   answerApprovedMailgenContent,
   sendEmail
};