import {
    CloudFrontClient,
    CreateInvalidationCommand
} from "@aws-sdk/client-cloudfront";

const client = new CloudFrontClient({});

const DISTRIBUTION_ID =
    process.env.CLOUDFRONT_DISTRIBUTION_ID;

export const handler = async (event) => {

    for (const record of event.Records) {

        const key = decodeURIComponent(
            record.s3.object.key.replace(/\+/g, " ")
        );

        try {

            await client.send(
                new CreateInvalidationCommand({

                    DistributionId: DISTRIBUTION_ID,

                    InvalidationBatch: {

                        CallerReference:
                            `${Date.now()}-${key}`,

                        Paths: {
                            Quantity: 1,
                            Items: [`/${key}`]
                        }
                    }
                })
            );

            console.log(
                `Invalidated: /${key}`
            );

        } catch (err) {

            console.error(
                `Failed invalidation for ${key}`,
                err
            );
        }
    }
};