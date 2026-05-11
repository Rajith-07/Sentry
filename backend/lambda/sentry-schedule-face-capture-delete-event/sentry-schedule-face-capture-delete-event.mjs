const {
    SchedulerClient,
    CreateScheduleCommand
} = require("@aws-sdk/client-scheduler");

const scheduler = new SchedulerClient({});

const DELETE_LAMBDA_ARN = process.env.DELETE_LAMBDA_ARN;
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN;

exports.handler = async (event) => {

    console.log("Received event:", JSON.stringify(event));

    for (const record of event.Records) {

        const bucket = record.s3.bucket.name;

        const key = decodeURIComponent(
            record.s3.object.key.replace(/\+/g, " ")
        );

        const deleteTime = new Date(
            Date.now() + 60 * 60 * 1000 // 1 hr in ms
        );

        const scheduleName =
            `delete-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 8)}`;

        await scheduler.send(
            new CreateScheduleCommand({

                Name: scheduleName,

                ScheduleExpression:
                    `at(${deleteTime.toISOString().split(".")[0]})`,

                FlexibleTimeWindow: {
                    Mode: "OFF"
                },

                Target: {
                    Arn: DELETE_LAMBDA_ARN,
                    RoleArn: SCHEDULER_ROLE_ARN,

                    Input: JSON.stringify({
                        bucket,
                        key
                    })
                },

                ActionAfterCompletion: "DELETE"
            })
        );

        console.log(`Scheduled deletion for ${key}`);
    }

    return {
        statusCode: 200
    };
};