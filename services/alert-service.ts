import { ResultAsync } from 'neverthrow';
import { sendEmailRaw } from '@/connectors/aws-ses-connector.ts';
import { z } from 'zod';

const emailOptsSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
});

export const sendEmail = (opts: unknown) =>
  ResultAsync.fromSafePromise(
    emailOptsSchema.parseAsync(opts).then((validatedOpts) =>
      sendEmailRaw({
        Destination: { ToAddresses: [validatedOpts.to] },
        Content: {
          Simple: {
            Subject: { Data: validatedOpts.subject },
            Body: {
              Html: { Data: validatedOpts.html ?? '' },
              Text: { Data: validatedOpts.text ?? '' },
            },
          },
        },
        FromEmailAddress: 'noreply@yourapp.dev', // Use a verified SES sender
      })
    ),
    (e) => new Error(`Validation or SES error: ${(e as Error).message}`)
  );