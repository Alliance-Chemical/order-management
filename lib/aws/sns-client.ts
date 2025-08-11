import { SNSClient, PublishCommand, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';

export const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendSNSAlert(topicArn: string, message: string, subject?: string) {
  const command = new PublishCommand({
    TopicArn: topicArn,
    Message: message,
    Subject: subject,
  });
  
  return await snsClient.send(command);
}

// Alias for compatibility
export const sendNotification = sendSNSAlert;

export async function createSNSTopic(name: string) {
  const command = new CreateTopicCommand({
    Name: name,
  });
  
  const response = await snsClient.send(command);
  return response.TopicArn;
}

export async function subscribeToTopic(topicArn: string, protocol: 'email' | 'sms', endpoint: string) {
  const command = new SubscribeCommand({
    TopicArn: topicArn,
    Protocol: protocol,
    Endpoint: endpoint,
  });
  
  return await snsClient.send(command);
}

export function formatAlertMessage(type: string, orderNumber: string, details: Record<string, any>): string {
  const timestamp = new Date().toLocaleString();
  return `
🚨 ${type.toUpperCase()} Alert
Order: ${orderNumber}
Time: ${timestamp}
${Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('\n')}
  `.trim();
}