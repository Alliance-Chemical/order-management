import { 
  SQSClient, 
  SendMessageCommand, 
  ReceiveMessageCommand, 
  DeleteMessageCommand,
  GetQueueUrlCommand,
  CreateQueueCommand 
} from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendMessage(queueUrl: string, messageBody: any, messageGroupId?: string) {
  const params: any = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
  };
  
  // Only add MessageGroupId for FIFO queues
  if (messageGroupId && queueUrl.includes('.fifo')) {
    params.MessageGroupId = messageGroupId;
  }
  
  const command = new SendMessageCommand(params);
  return await sqsClient.send(command);
}

export async function receiveMessages(queueUrl: string, maxMessages: number = 10) {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: 20, // Long polling
  });
  
  const response = await sqsClient.send(command);
  return response.Messages || [];
}

export async function deleteMessage(queueUrl: string, receiptHandle: string) {
  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  });
  
  return await sqsClient.send(command);
}

export async function getQueueUrl(queueName: string) {
  const command = new GetQueueUrlCommand({
    QueueName: queueName,
  });
  
  const response = await sqsClient.send(command);
  return response.QueueUrl;
}

export async function createQueue(queueName: string, isFifo: boolean = false) {
  const command = new CreateQueueCommand({
    QueueName: queueName,
    Attributes: isFifo ? {
      FifoQueue: 'true',
      ContentBasedDeduplication: 'true',
    } : {},
  });
  
  const response = await sqsClient.send(command);
  return response.QueueUrl;
}