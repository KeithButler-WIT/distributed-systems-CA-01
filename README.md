## ServerlessREST assignment - Distributed Systems.

__Name:__ Keith Butler

__Student Number:__ 20089137

This repository contains the implementation of a serverless REST API for the AWS platform. A CDK stack creates the infrastructure. The domain context of the API is movie reviews.

### API endpoints.
 
+ POST /movies/reviews - add a movie review.
+ GET /movies/reviews/{reviewerName} - Get all the reviews written by the named reviewer.
+ GET /movies/{movieId}/reviews - Get all the reviews for a movie with the specified id.
+ GET /movies/{movieId}/reviews?rating=n - Get all the reviews for the movie with the specified ID with a rating greater than the rating.
+ GET /movies/{movieId}/reviews/{reviewerName} - Get the review for the movie with the specified movie ID and written by the named reviewer.

![](./images/api1.png)

![](./images/api2.png)

### Authentication..

![](./images/pool.png)