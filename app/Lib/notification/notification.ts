import { promises } from 'fs';
import path from 'path';
import { compile } from 'handlebars';
import { createTransport } from 'nodemailer';

interface ISendEmail {
  from?: string;
  to: string;
  subject: string;
  template: string;
  replacements: any;
}

class NotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundException";
  }
}

export class NotificationService {
  private emailSenders = {
    noreply: process.env.EMAIL_NOREPLY || 'info@westerntreasury.com',
  };

  async getHtml(html_file: string, replacements: any) {
    const filePath = path.join(
      __dirname,
      `./email-templates/${html_file}.html`,
    );

    try {
      const data = await promises.readFile(filePath, { encoding: "utf-8" });
      const template = compile(data);
      return template(replacements);
    } catch (error: any) {
      console.error('Error reading email template file:', error.message);
      throw new NotFoundException("Email template not found");
    }
  }

  async sendEmail({
    from = this.emailSenders.noreply,
    to,
    subject,
    template, // name of html file with template
    replacements,
  }: ISendEmail) {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email environment variables are not properly set.");
    }

    try {
      const transporter = createTransport({
        host: String(process.env.EMAIL_HOST),
        port: Number(process.env.EMAIL_PORT),
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        requireTLS: true,
      });


      // try {
      //   console.log('testing..');
      //   await transporter.verify();
      //   console.log('SMTP is ready to send messages.');
      // } catch (err) {
      //   console.error('SMTP Connection Error:', err);
      // }

      const html = await this.getHtml(template, replacements);

      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      // console.log(`Email sent: ${message.messageId}`);
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error('Sending mail failed')
    }
  }
}
