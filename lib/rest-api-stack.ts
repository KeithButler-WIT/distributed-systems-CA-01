import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { generateBatch } from "../shared/util";
import { movies, movieReviews } from "../seed/movies";
import * as apig from "aws-cdk-lib/aws-apigateway";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "reviewDate", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });
    
    movieReviewsTable.addLocalSecondaryIndex({
      indexName: "reviewIx",
      sortKey: { name: "reviewerName", type: dynamodb.AttributeType.STRING },
    });


    // Functions 
    const getAllReviewsFn = new lambdanode.NodejsFunction(
      this,
      "GetAllReviewsFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getAllReviews.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const newReviewFn = new lambdanode.NodejsFunction(this, "AddReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const getReviewsByNameFn = new lambdanode.NodejsFunction(this, "GetReviewsByNameFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/getReviewsByName.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const getReviewsByNameAndIdFn = new lambdanode.NodejsFunction(this, "GetReviewsByNameAndIdFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/getReviewsByNameAndId.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],  // Includes movie reviews
      }),
    });

    const getAllReviewsByRatingFn = new lambdanode.NodejsFunction(this, "GetAllReviewsByRatingFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/getAllReviewsByRating.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });


    // REST API 
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      // 👇 enable CORS
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });


    const moviesEndpoint = api.root.addResource("movies");

      const reviewEndpoint = moviesEndpoint.addResource("reviews");
      reviewEndpoint.addMethod(
        "POST",
        new apig.LambdaIntegration(newReviewFn, { proxy: true })
      );

        // Get all the reviews written by a specific user
        const reviewerNameEndpoint = reviewEndpoint.addResource("{reviewerName}");
        reviewerNameEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getReviewsByNameFn, { proxy: true })
        );

      const movieEndpoint = moviesEndpoint.addResource("{movieId}");

        const reviewsEndpoint = movieEndpoint.addResource("reviews");
        // reviewsEndpoint.addMethod(
        //   "GET",
        //   new apig.LambdaIntegration(getAllReviewsFn, { proxy: true })
        // );
        reviewsEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getAllReviewsByRatingFn, { proxy: true })
        );

          // Get the review for the movie with the specified movie ID and written by the named reviewer.
          const reviewNameEndpoint = reviewsEndpoint.addResource("{reviewerName}");
          reviewNameEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getReviewsByNameAndIdFn, { proxy: true })
          );


    // Permissions 
    movieReviewsTable.grantReadWriteData(newReviewFn)
    movieReviewsTable.grantReadData(getReviewsByNameFn)
    movieReviewsTable.grantReadData(getReviewsByNameAndIdFn)
    movieReviewsTable.grantReadData(getAllReviewsByRatingFn)
    movieReviewsTable.grantReadData(getAllReviewsFn)

  }
}
