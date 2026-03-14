export interface OMDBRating {
	Source: string
	Value: string
}

export interface OMDBResponse {
	Title: string
	Year: string
	Rated: string
	Released: string
	Runtime: string
	Genre: string
	Director: string
	Writer: string
	Actors: string
	Plot: string
	Poster: string
	Ratings: OMDBRating[]
	Metascore: string
	imdbRating: string
	imdbVotes: string
	imdbID: string
	Type: string
	Response: 'True' | 'False'
	Error?: string
}
