const apiKey = 'add your api key';
const baseURL = 'https://www.omdbapi.com/';
function searchIMDb(query, sendResponse) {
    //console.log(`fetching imdb data for ${query}`);
    return fetch(`${baseURL}?apikey=${apiKey}&s=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.Response === "True") {
                sendResponse({"results": data.Search});
                return data.Search;
            } else {
                throw new Error(data.Error);
            }
        });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Vidsrc++ Extension installed');
});
  
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    //console.log(`got message ${request.action}`);
    if (request.action === 'queryIMDb') {
        //console.log(`imdb query ${request.query}`);
        searchIMDb(request.query, sendResponse);
    } else if (request.action === 'queryIMDbDetails') {
        fetch(`${baseURL}?i=${request.imdbID}&apikey=${apiKey}`)
            .then(response => response.json())
            .then(data => {
                console.log(data);
                sendResponse({"results": data});
            })
            .catch(error => console.error('Error fetching IMDb details:', error));
    } else if (request.action === 'queryIMDbSeasonDetails') {
        fetch(`${baseURL}?i=${request.imdbID}&Season=${request.season}&apikey=${apiKey}`)
            .then(response => response.json())
            .then(data => {
                data["SeriesID"] = request.imdbID;
                console.log(data);
                sendResponse(data);
            })
            .catch(error => console.error('Error fetching IMDb season details:', error));
    }
    return true; // Indicates we will respond asynchronously
});