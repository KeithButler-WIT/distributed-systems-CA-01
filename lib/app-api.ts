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
import { Aws } from "aws-cdk-lib";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";


type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
};

export class AppApi extends Construct {
  constructor(scope: Construct, id: string, props: AppApiProps) {
    super(scope, id);

    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "reviewerName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });
    
    movieReviewsTable.addLocalSecondaryIndex({
      indexName: "reviewIx",
      sortKey: { name: "reviewDate", type: dynamodb.AttributeType.STRING },
    });

    // REST API 
    const AppApi = new apig.RestApi(this, "AppApi", {
      description: "demo api",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });


    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
        TABLE_NAME: movieReviewsTable.tableName,
      },
    };

    // Functions 
    const getAllReviewsFn = new node.NodejsFunction(this, "GetAllReviewsFn", {       
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/getAllReviews.ts`,
    });

    const newReviewFn = new node.NodejsFunction(this, "AddReviewFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/addReview.ts`,
    });

    const getReviewsByNameFn = new lambdanode.NodejsFunction(this, "GetReviewsByNameFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/getReviewsByName.ts`,
    });

    const getReviewsByNameAndIdFn = new lambdanode.NodejsFunction(this, "GetReviewsByNameAndIdFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/getReviewsByNameAndId.ts`,
    });

    const getAllReviewsByRatingFn = new lambdanode.NodejsFunction(this, "GetAllReviewsByRatingFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/getAllReviewsByRating.ts`,
    });

    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/authorizer.ts",
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );

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
        resources: [movieReviewsTable.tableArn],
      }),
    });

    const moviesEndpoint = AppApi.root.addResource("movies");
      const reviewEndpoint = moviesEndpoint.addResource("reviews");
        reviewEndpoint.addMethod("POST", new apig.LambdaIntegration(newReviewFn), {      
          authorizer: requestAuthorizer,
          authorizationType: apig.AuthorizationType.CUSTOM,
        });

        // Get all the reviews written by a specific user
        const reviewerNameEndpoint = reviewEndpoint.addResource("{reviewerName}");
        reviewerNameEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getReviewsByNameFn)
        );

      const movieEndpoint = moviesEndpoint.addResource("{movieId}");

        const reviewsEndpoint = movieEndpoint.addResource("reviews");
        // reviewsEndpoint.addMethod(
          // "GET",
          // new apig.LambdaIntegration(getAllReviewsFn)
          // new apig.LambdaIntegration(getAllReviewsByRatingFn)
        // );
        reviewsEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getAllReviewsByRatingFn)
        );

          // Get the review for the movie with the specified movie ID and written by the named reviewer.
          const reviewNameEndpoint = reviewsEndpoint.addResource("{reviewerName}");
          reviewNameEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getReviewsByNameAndIdFn)
          );


    // Permissions 
    movieReviewsTable.grantReadWriteData(newReviewFn)
    movieReviewsTable.grantReadData(getReviewsByNameFn)
    movieReviewsTable.grantReadData(getReviewsByNameAndIdFn)
    movieReviewsTable.grantReadData(getAllReviewsByRatingFn)
    movieReviewsTable.grantReadData(getAllReviewsFn)

  }
}
