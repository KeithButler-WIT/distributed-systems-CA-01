export type Movie = {
    movieId: number;
    genre_ids: number[];
    original_language : string;
    overview: string;
    popularity: number;
    release_date: string;
    title: string
    video: boolean;
    vote_average: number;
    vote_count: number
  }


  export type MovieReview = {
    movieId: number;
    reviewerName: string;
    reviewDate: string;
    content: string
    rating: number
  }

  // Used to validate the query string og HTTP Get requests
  export type MovieReviewQueryParams = {
    movieId?: string;
    reviewerName?: string;
    reviewDate?: string;
    rating?: number
  }