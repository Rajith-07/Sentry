import {
  RekognitionClient,
  IndexFacesCommand
} from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({
  region: process.env.REGION
});

const COLLECTION_ID = process.env.COLLECTION_ID;

export const handler = async (event) => {
  try {
    for (const record of event.Records) {

      const bucket = record.s3.bucket.name;

      const key = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, " ")
      );

      // Extract filename only
      const filename = key.split("/").pop();

      // Remove extension
      const externalImageId = filename.replace(/\.[^/.]+$/, "");

      console.log("Processing:", {
        bucket,
        key,
        externalImageId
      });

      const command = new IndexFacesCommand({
        CollectionId: COLLECTION_ID,

        Image: {
          S3Object: {
            Bucket: bucket,
            Name: key
          }
        },

        ExternalImageId: externalImageId,

        DetectionAttributes: [],

        MaxFaces: 1,

        QualityFilter: "AUTO"
      });

      const response = await rekognition.send(command);

      console.log(
        "Indexed successfully:",
        JSON.stringify(response, null, 2)
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Faces indexed successfully"
      })
    };

  } catch (error) {

    console.error("Error indexing face:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};