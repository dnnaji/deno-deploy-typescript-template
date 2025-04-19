import { SESv2Client, SendEmailCommand } from 'jsr:@aws-sdk/client-sesv2';
import { Result, err, ok } from 'neverthrow';
import { retry } from '@std/async/retry';
import { cfg } from '../config.ts';
import { getChildLogger } from '../utils/log.ts';

const logger = getChildLogger('aws-ses-connector');
let sesClient: SESv2Client | null = null; // Lazy initialization

function getSesClient() {
  if (!sesClient) {
    logger.debug('Initializing SESv2Client...');
    sesClient = new SESv2Client({
      region: cfg.ses.region,
      credentials: {
        accessKeyId: cfg.ses.accessKeyId,
        secretAccessKey: cfg.ses.secretAccessKey,
      },
    });
  }
  return sesClient;
}

export async function sendEmailRaw(
  params: SendEmailCommand['input']
): Promise<Result<string, Error>> {
  const sendOperation = async () => {
    try {
      const client = getSesClient();
      logger.info(
        `Attempting to send email to: ${params.Destination?.ToAddresses?.join(', ')}`
      );
      await client.send(new SendEmailCommand(params));
      logger.info('Email sent successfully via SES');
      return ok('Email sent successfully');
    } catch (e) {
      logger.error(`SES send attempt failed: ${(e as Error).message}`);
      throw new Error(`SES error: ${(e as Error).message}`);
    }
  };

  try {
    const result = await retry(sendOperation, {
      multiplier: 2,
      maxAttempts: 3,
      minTimeout: 100,
      maxTimeout: 1000,
      jitter: 0.2,
    });
    return result;
  } catch (e) {
    logger.error(`SES send failed after retries: ${(e as Error).message}`);
    return err(e as Error);
  }
}