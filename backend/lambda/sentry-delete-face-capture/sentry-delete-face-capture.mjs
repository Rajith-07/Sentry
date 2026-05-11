import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

export const handler = async (event) => {
    console.log("Received Event:", JSON.stringify(event));

    const bucket = event.bucket;
    const key = event.key;

    if (!bucket || !key) {
        throw new Error("Missing bucket or key");
    }

    try {
        await s3.send(
            new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
            })
        );

        console.log(`Deleted object: ${bucket}/${key}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Object deleted successfully"
            })
        };
    } catch (error) {
        console.error("Delete failed:", error);
        throw error;
    }
};