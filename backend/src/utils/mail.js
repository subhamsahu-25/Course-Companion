import Mailgen from "mailgen";
import Nodemailer from "nodemailer";

const sendEmail = async (options) => {
   const mailGenerator = new Mailgen({
      theme: "default",
      product: {
         name: "Task Manager",
         link: "https://taskmanageLink.com"
      }
   })

   const emailTextual = mailGenerator.generatePlaintext({ body: options.mailgenContent })
   const emailHtml = mailGenerator.generate({ body: options.mailgenContent })

   const transporter = Nodemailer.createTransport({
      host: process.env.MAILTRAP_SMTP_HOST,
      port: process.env.MAILTRAP_SMTP_PORT,
      auth: {
         user: process.env.MAILTRAP_SMTP_USER,
         pass: process.env.MAILTRAP_SMTP_PASS
      }
   })

   const mail = {
      from: "Task Manager <taskManager@taskManager.com>",
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