import * as nodemailer from 'nodemailer';

interface SendEmailDto {
    text: string;
    to: string;
    subject: string;
    html: string;
    attachments?: {
      filename: string;
      content: any;
      contentType: string;
      contentTransferEncoding: string;
    }[];
  }
  
  export const sendEmail = async (sendEmailDto: SendEmailDto) => {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', // Mailtrap SMTP host
      port: 587, // Mailtrap SMTP port
      auth: {
        user: process.env.EMAIL_USERNAME, // Mailtrap username from environment variable
        pass: process.env.EMAIL_PASSWORD, // Mailtrap password from environment variable
      },
    });
  
    const mailOptions = {
      from: 'ABI ISP <worksheet.dev@gmail.com>', // The sender's name and email
      to: `${sendEmailDto.to}`, // Recipient email address
      subject: sendEmailDto.subject, // Subject of the email
      text: sendEmailDto.text, // Plain text body
      html: sendEmailDto.html, // HTML body
    };
  
    // Attachments (if provided)
    if (sendEmailDto.attachments) {
      mailOptions['attachments'] = sendEmailDto.attachments;
    }
  
    // Send the email
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Error occurred while sending email:', error);
      throw error; // Throw error if email sending fails
    }
  };