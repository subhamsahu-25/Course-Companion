import Mailgen from "mailgen";
import Nodemailer from "nodemailer";

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

    // Generic SMTP_* names with MAILTRAP_* fallback, so switching providers
    // (Mailtrap sandbox ↔ Gmail) is env-only, never a code change.
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

   try {
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

export {
   emailVerificationMailgenContent,
   forgotPasswordMailgenContent,
   sendEmail
};